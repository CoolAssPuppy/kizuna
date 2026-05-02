import fs from 'node:fs';

const envExamplePath = new URL('../.env.example', import.meta.url);
const envExample = fs.readFileSync(envExamplePath, 'utf8');

const secretPattern = /^VITE_.*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i;
const violations = [];

for (const rawLine of envExample.split('\n')) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.slice(0, eq).trim();
  if (secretPattern.test(key)) violations.push(key);
}

if (violations.length > 0) {
  console.error('[security] Disallowed client-exposed env keys found in .env.example:');
  for (const key of violations) console.error(` - ${key}`);
  process.exit(1);
}

console.log('[security] VITE env key check passed.');
