#!/usr/bin/env tsx
/**
 * Locale parity checker. Compares every locale under src/locales/ against
 * the en-US source-of-truth and reports missing keys, orphan keys, and
 * placeholder mismatches. Returns a non-zero status when parity is broken.
 *
 * Usage:
 *   npm run i18n:check               check, fail on any drift
 *   tsx scripts/check-locale-parity.ts --report     show diff, exit 0
 *   tsx scripts/check-locale-parity.ts --fill       backfill missing keys
 *                                                   with __TODO_LOCALE__
 *                                                   prefix so the app
 *                                                   still renders
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(here, '..', 'src', 'locales');
const SOURCE_LOCALE = 'en-US';
const TODO_PREFIX = '__TODO_LOCALE__ ';

type Tree = { [key: string]: Tree | string };

function readLocale(locale: string): Tree {
  const path = resolve(LOCALES_DIR, locale, 'common.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as Tree;
}

function writeLocale(locale: string, tree: Tree): void {
  const path = resolve(LOCALES_DIR, locale, 'common.json');
  writeFileSync(path, JSON.stringify(tree, null, 2) + '\n');
}

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

function setNested(tree: Tree, path: string[], value: string): void {
  let cursor: Tree = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i] ?? '';
    const next = cursor[segment];
    if (typeof next !== 'object' || next === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Tree;
  }
  cursor[path[path.length - 1] ?? ''] = value;
}

function placeholders(s: string): Set<string> {
  const out = new Set<string>();
  const re = /\{\{\s*([^}\s]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.add(m[1] ?? '');
  return out;
}

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

const args = new Set(process.argv.slice(2));
const fill = args.has('--fill');
const reportOnly = args.has('--report');

const locales = readdirSync(LOCALES_DIR).filter((name) => {
  try {
    readLocale(name);
    return name !== SOURCE_LOCALE;
  } catch {
    return false;
  }
});

const sourceFlat = flatten(readLocale(SOURCE_LOCALE));
let totalMissing = 0;
let totalOrphan = 0;
let totalPlaceholderDrift = 0;

for (const locale of locales) {
  const tree = readLocale(locale);
  const flat = flatten(tree);
  const missing: string[] = [];
  const orphan: string[] = [];
  const placeholderDrift: string[] = [];

  for (const [key, value] of sourceFlat) {
    if (!flat.has(key)) {
      missing.push(key);
      continue;
    }
    const sourcePlace = placeholders(value);
    const targetPlace = placeholders(flat.get(key) ?? '');
    if (!setEq(sourcePlace, targetPlace)) placeholderDrift.push(key);
  }
  for (const key of flat.keys()) {
    if (!sourceFlat.has(key)) orphan.push(key);
  }

  totalMissing += missing.length;
  totalOrphan += orphan.length;
  totalPlaceholderDrift += placeholderDrift.length;

  const completion = Math.round(((sourceFlat.size - missing.length) / sourceFlat.size) * 100);
  const ok = missing.length === 0 && placeholderDrift.length === 0;
  const tag = ok ? 'ok' : 'drift';
  console.log(
    `${locale.padEnd(7)} ${completion}%  missing=${missing.length}  orphan=${orphan.length}  placeholderDrift=${placeholderDrift.length}  [${tag}]`,
  );
  if (missing.length > 0 && !fill && !reportOnly) {
    for (const key of missing.slice(0, 10)) console.log(`  missing: ${key}`);
    if (missing.length > 10) console.log(`  ...and ${missing.length - 10} more`);
  }

  if (fill && missing.length > 0) {
    for (const key of missing) {
      const enValue = sourceFlat.get(key) ?? '';
      setNested(tree, key.split('.'), TODO_PREFIX + enValue);
    }
    writeLocale(locale, tree);
    console.log(`  -> filled ${missing.length} keys with ${TODO_PREFIX} placeholder.`);
  }
}

if (!fill && !reportOnly) {
  if (totalMissing > 0 || totalPlaceholderDrift > 0) {
    console.error(
      `\nLocale parity broken: ${totalMissing} missing key(s), ${totalPlaceholderDrift} placeholder mismatch(es) across ${locales.length} locales.`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${locales.length} locales at parity with ${SOURCE_LOCALE}.`);
}

console.log(
  `\nSource: ${sourceFlat.size} keys. Locales checked: ${locales.length}. Total missing: ${totalMissing}, orphan: ${totalOrphan}.`,
);
