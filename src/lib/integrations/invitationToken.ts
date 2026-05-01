/**
 * Signed JWTs for guest invitation links.
 *
 * Used in two places: the create_guest_invitation edge function signs a
 * 7-day token; the /accept-invitation route verifies it before letting the
 * guest create credentials. Web Crypto HS256 keeps us dependency-free and
 * portable between Deno (edge functions) and the browser (tests + dev).
 */

import { INVITATION_TTL_SECONDS } from '@/lib/constants';

export interface InvitationClaims {
  /** invitation row id (uuid) */
  inv: string;
  /** sponsoring employee user_id */
  sub: string;
  /** guest email */
  email: string;
  /** issued-at unix seconds */
  iat: number;
  /** expires-at unix seconds */
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
  /** TTL in seconds. Defaults to 7 days. */
  ttlSeconds?: number;
  /** Override clock for tests (unix seconds). */
  now?: number;
}

export async function signInvitationToken(args: SignArgs): Promise<string> {
  const now = args.now ?? Math.floor(Date.now() / 1000);
  const ttl = args.ttlSeconds ?? INVITATION_TTL_SECONDS;
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
  const sigEncoded = base64UrlEncode(new Uint8Array(sig));
  return `${signingInput}.${sigEncoded}`;
}

export type VerificationFailure =
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'bad_signature' }
  | { ok: false; reason: 'expired' };

export type VerificationResult = { ok: true; claims: InvitationClaims } | VerificationFailure;

interface VerifyArgs {
  secret: string;
  token: string;
  /** Override clock for tests (unix seconds). */
  now?: number;
}

export async function verifyInvitationToken(args: VerifyArgs): Promise<VerificationResult> {
  const parts = args.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, body, sig] = parts as [string, string, string];

  const key = await hmacKey(args.secret);
  // base64UrlDecode returns a Uint8Array; copying through .slice() narrows the
  // backing ArrayBufferLike to ArrayBuffer for WebCrypto's BufferSource.
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sig).slice(),
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
