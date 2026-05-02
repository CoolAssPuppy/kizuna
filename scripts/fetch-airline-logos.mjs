#!/usr/bin/env node
// Pre-fetch top airline logos from Daisycon and save them to
// public/airline-logos/. Run once (or whenever src/data/airlines.json
// is updated). Owned assets > third-party CDN runtime dependency.
//
// Daisycon's TOS allow this for commercial use as long as the airline
// name is shown next to the logo — kizuna's UI does that everywhere a
// flight is rendered, so we're covered.
//
// Usage:
//   node scripts/fetch-airline-logos.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AIRLINES_PATH = join(ROOT, 'src', 'data', 'airlines.json');
const OUT_DIR = join(ROOT, 'public', 'airline-logos');

// Daisycon returns ~1KB blanks when it has no logo for an IATA code.
// Real logos are 3-30KB. 2KB is a safe lower bound.
const MIN_BYTES = 2000;
const URL_TEMPLATE = (iata) =>
  `https://daisycon.io/images/airline/?iata=${iata}&width=300&height=150`;

const airlines = JSON.parse(await readFile(AIRLINES_PATH, 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

const missed = [];
let okCount = 0;

for (const { iata, name } of airlines) {
  process.stdout.write(`${iata.padEnd(2)}  ${name.padEnd(34)} `);
  try {
    const res = await fetch(URL_TEMPLATE(iata));
    if (!res.ok) {
      console.log(`FAIL http ${res.status}`);
      missed.push({ iata, name, why: `http ${res.status}` });
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES) {
      console.log(`SKIP ${buf.length}b (placeholder)`);
      missed.push({ iata, name, why: `${buf.length}b placeholder` });
      continue;
    }
    await writeFile(join(OUT_DIR, `${iata}.png`), buf);
    console.log(`OK   ${buf.length}b`);
    okCount++;
  } catch (err) {
    console.log(`ERR  ${err.message}`);
    missed.push({ iata, name, why: err.message });
  }
  // Stay polite: 100ms between requests, ~10s total for 100 airlines.
  await new Promise((r) => setTimeout(r, 100));
}

console.log(`\n${okCount}/${airlines.length} fetched.`);
if (missed.length) {
  console.log('\nMissed (fall back to airline name in UI):');
  for (const m of missed) console.log(`  ${m.iata}  ${m.name}  (${m.why})`);
}
