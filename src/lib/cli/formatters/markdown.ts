export function fencedJson(data: unknown): string {
  return ['```json', JSON.stringify(data, null, 2), '```'].join('\n');
}
