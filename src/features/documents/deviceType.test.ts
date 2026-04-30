import { describe, expect, it } from 'vitest';

import { detectDeviceType } from './deviceType';

describe('detectDeviceType', () => {
  it('classifies common iPhone strings as mobile', () => {
    expect(
      detectDeviceType(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe('mobile');
  });

  it('classifies common Android phone strings as mobile', () => {
    expect(
      detectDeviceType(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
      ),
    ).toBe('mobile');
  });

  it('classifies iPad strings as tablet', () => {
    expect(
      detectDeviceType('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15'),
    ).toBe('tablet');
  });

  it('classifies desktop browser strings as desktop', () => {
    expect(
      detectDeviceType(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      ),
    ).toBe('desktop');
  });

  it('falls back to desktop for empty or unrecognised strings', () => {
    expect(detectDeviceType('')).toBe('desktop');
    expect(detectDeviceType('curl/8.4.0')).toBe('desktop');
  });
});
