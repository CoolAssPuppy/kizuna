/**
 * Client-side PDF → text extractor using pdfjs-dist.
 *
 * Lazy-imports the library so it stays out of the main route bundle —
 * the cost (~600 KB gzipped including the worker) is paid only when
 * the user opens the import dialog AND picks a PDF. Workers run
 * off-main-thread courtesy of Vite's `?url` import.
 */

interface ExtractOptions {
  /** Hard ceiling on characters returned. 48 KB matches the OpenAI side limit. */
  maxChars?: number;
  /** Override fetch for tests; not normally needed. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_MAX_CHARS = 48_000;

export async function extractTextFromPdf(
  file: File,
  options: ExtractOptions = {},
): Promise<string> {
  const { maxChars = DEFAULT_MAX_CHARS } = options;

  const pdfjs = await import('pdfjs-dist');
  // The worker file ships next to the main bundle and Vite resolves it
  // to a hashed URL we can hand to GlobalWorkerOptions.
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    // Each item carries a `str` and a `transform` matrix. Joining on
    // whitespace and inserting a newline at the end of each y-row gives
    // OpenAI a layout-ish text that mirrors the visual document.
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    pages.push(pageText);

    // Bail early if we've already collected enough text to send.
    const totalSoFar = pages.join('\n\n').length;
    if (totalSoFar >= maxChars) break;
  }

  await doc.destroy();
  const combined = pages.join('\n\n');
  return combined.length > maxChars ? `${combined.slice(0, maxChars)}\n\n[truncated]` : combined;
}
