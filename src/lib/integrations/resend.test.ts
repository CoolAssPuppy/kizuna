import { describe, expect, it, vi } from 'vitest';

import { createResendDriver, resendStatus, type EmailMessage } from './resend';

describe('resendStatus', () => {
  it('returns live when an api key is present', () => {
    expect(resendStatus({ apiKey: 're_test_123' })).toEqual({ mode: 'live' });
  });

  it('returns stubbed when no api key is present', () => {
    expect(resendStatus({})).toEqual({
      mode: 'stubbed',
      reason: 'RESEND_API_KEY missing',
    });
  });
});

describe('createResendDriver', () => {
  it('records sent messages in the outbox when stubbed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const outbox: EmailMessage[] = [];
    const driver = createResendDriver({ outbox });

    const result = await driver.send({
      to: 'guest@example.com',
      from: 'hello@kizuna.example',
      subject: 'You are invited',
      html: '<p>...</p>',
    });

    expect(result.delivered).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe('guest@example.com');
  });

  it('calls the Resend API when keyed and returns the response id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg_abc' }),
    });
    const driver = createResendDriver({ apiKey: 're_test_123', fetchImpl });

    const result = await driver.send({
      to: 'paul@kizuna.dev',
      from: 'hello@kizuna.example',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });

    expect(result.id).toBe('msg_abc');
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test_123' });
  });

  it('throws when the Resend API returns an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'invalid_to' }),
    });
    const driver = createResendDriver({ apiKey: 're_test_123', fetchImpl });

    await expect(driver.send({ to: 'bad', from: 'a@b', subject: 's', html: '' })).rejects.toThrow(
      'invalid_to',
    );
  });
});
