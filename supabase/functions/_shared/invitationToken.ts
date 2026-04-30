// Mirror of src/lib/integrations/invitationToken.ts so edge functions can
// import without crossing module systems. Web Crypto is identical between
// browser, node, and Deno so the implementation is byte-for-byte the same.

export interface InvitationClaims {
  inv: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

interface SignArgs {
  secret: string;
  invitationId: string;
  sponsorUserId: string;
  guestEmail: string;
  ttlSeconds?: number;
  now?: number;
}

export async function signInvitationToken(args: SignArgs): Promise<string> {
  const now = args.now ?? Math.floor(Date.now() / 1000);
  const ttl = args.ttlSeconds ?? 7 * 24 * 60 * 60;
  const claims: InvitationClaims = {
    inv: args.invitationId,
    sub: args.sponsorUserId,
    email: args.guestEmail,
    iat: now,
    exp: now + ttl,
  };
  const header = base64UrlEncode(ENCODER.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(ENCODER.encode(JSON.stringify(claims)));
  const signingInput = `${header}.${body}`;
  const key = await hmacKey(args.secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export type VerificationResult =
  | { ok: true; claims: InvitationClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyInvitationToken(args: {
  secret: string;
  token: string;
  now?: number;
}): Promise<VerificationResult> {
  const parts = args.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, body, sig] = parts as [string, string, string];

  const key = await hmacKey(args.secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sig),
    ENCODER.encode(`${header}.${body}`),
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };

  let claims: InvitationClaims;
  try {
    claims = JSON.parse(DECODER.decode(base64UrlDecode(body))) as InvitationClaims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const now = args.now ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}
