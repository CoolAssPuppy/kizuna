/**
 * Client-side image processing for photo gallery uploads.
 *
 * processImage takes a user-selected File, decodes it via
 * createImageBitmap, paints it onto an OffscreenCanvas (or
 * HTMLCanvasElement fallback) at three sizes, and returns the original
 * blob plus 1280px and 320px WebP renditions. The math lives in
 * computeFitDimensions so it can be unit-tested without a DOM.
 */

export interface FitDimensions {
  width: number;
  height: number;
}

const PREVIEW_LONG_EDGE = 1280;
const THUMB_LONG_EDGE = 320;
const WEBP_QUALITY = 0.85;

export function computeFitDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): FitDimensions {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface ProcessedImage {
  /** The user's original file, untouched. */
  original: File;
  /** WebP blob at most PREVIEW_LONG_EDGE on the long side. */
  preview: Blob;
  /** WebP blob at most THUMB_LONG_EDGE on the long side. */
  thumb: Blob;
  /** Intrinsic dimensions of the original. */
  width: number;
  height: number;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const preview = await renderToWebp(bitmap, computeFitDimensions(width, height, PREVIEW_LONG_EDGE));
    const thumb = await renderToWebp(bitmap, computeFitDimensions(width, height, THUMB_LONG_EDGE));
    return { original: file, preview, thumb, width, height };
  } finally {
    bitmap.close?.();
  }
}

async function renderToWebp(bitmap: ImageBitmap, dims: FitDimensions): Promise<Blob> {
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, dims.width, dims.height);
  return canvasToBlob(canvas);
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: AnyCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/webp',
      WEBP_QUALITY,
    );
  });
}
