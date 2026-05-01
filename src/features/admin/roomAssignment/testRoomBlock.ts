/**
 * Deterministic 60-room block covering five typologies (standard king,
 * standard double, family, suite, accessible). Used to seed the import
 * dialog for demos and manual testing without typing 60 rows. Removed
 * once the demo phase ends.
 */
export function buildTestRoomBlockCsv(): string {
  const lines = ['room_number,description,size_sqm,is_suite'];
  // 30 standard king rooms (28-32 sqm)
  for (let i = 0; i < 30; i += 1) {
    const num = 100 + i;
    const sqm = 28 + (i % 5);
    lines.push(`${num},Standard king with mountain view,${sqm},false`);
  }
  // 12 standard double-double rooms (32-38 sqm)
  for (let i = 0; i < 12; i += 1) {
    const num = 200 + i;
    const sqm = 32 + (i % 7);
    lines.push(`${num},Standard double-double,${sqm},false`);
  }
  // 8 family rooms (45-55 sqm) — non-suite but family-typed via description
  for (let i = 0; i < 8; i += 1) {
    const num = 300 + i;
    const sqm = 45 + (i % 11);
    lines.push(`${num},Family suite with separate kids' nook,${sqm},false`);
  }
  // 6 suites (60-90 sqm)
  const suites = [
    [400, 'One-bedroom executive suite', 60],
    [401, 'One-bedroom executive suite', 62],
    [402, 'Two-bedroom suite with terrace', 75],
    [403, 'Two-bedroom suite with terrace', 78],
    [404, 'Penthouse suite', 88],
    [405, 'Penthouse suite', 92],
  ] as const;
  for (const [num, desc, sqm] of suites) {
    lines.push(`${num},${desc},${sqm},true`);
  }
  // 4 accessible rooms (35-40 sqm)
  for (let i = 0; i < 4; i += 1) {
    const num = 500 + i;
    const sqm = 35 + i;
    lines.push(`${num},Accessible king with roll-in shower,${sqm},false`);
  }
  return lines.join('\n');
}
