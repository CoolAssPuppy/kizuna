// One-shot rasterizer: public/og-image.svg -> public/og-image.png at
// 1200x630. Run via `node scripts/generate-og.mjs` whenever the SVG
// changes. We commit the PNG so the OG crawler doesn't have to render
// at request time.
//
// Inter is loaded from assets/fonts so the OG render matches the
// site (tailwind.config.ts: sans = Inter, system-ui, sans-serif).
// System fonts stay enabled so the CJK kanji 絆 still resolves via
// Hiragino on macOS / Noto on Linux.

import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('public/og-image.svg', 'utf-8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: {
    loadSystemFonts: true,
    fontFiles: [
      'assets/fonts/Inter-Regular.otf',
      'assets/fonts/Inter-Medium.otf',
      'assets/fonts/Inter-SemiBold.otf',
      'assets/fonts/Inter-Bold.otf',
    ],
    defaultFontFamily: 'Inter',
  },
});
const pngBuffer = resvg.render().asPng();
writeFileSync('public/og-image.png', pngBuffer);
console.log('wrote public/og-image.png (%d bytes)', pngBuffer.length);
