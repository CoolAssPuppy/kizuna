// Mints a short-lived Supabase JWT bound to a user, signed with
// SUPABASE_JWT_SECRET. The minted token has the same shape as a real
// session JWT (aud=authenticated, role=authenticated, sub=user_id),
// so when the edge function attaches it to a Supabase client the
// downstream RLS policies see auth.uid() = user_id and gate access
// exactly as if the user had signed in via the browser.
//
// We carry the kizuna-specific app_role claim so the RLS helper
// public.auth_role() reads the right value without extra round-trips.
// Lifetime is 60 seconds — long enough for one command, short enough
// that a leaked token is useless. The PAT itself stays the durable
// credential; this token is per-request.

import { SignJWT } from 'jose';

declare const Deno: { env: { get: (k: string) => string | undefined } };

const TOKEN_LIFETIME_SECONDS = 60;

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = Deno.env.get('SUPABASE_JWT_SECRET') ?? Deno.env.get('SB_JWT_SECRET');
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not set in the edge function environment.');
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export interface MintedToken {
  token: string;
  expiresAt: number;
}

export async function mintUserToken(input: {
  userId: string;
  appRole: string;
  email?: string;
}): Promise<MintedToken> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const token = await new SignJWT({
    role: 'authenticated',
    app_role: input.appRole,
    email: input.email,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());
  return { token, expiresAt };
}
