// Shared env-var readers for edge functions. Falling back to localhost
// keeps local dev painless when the var hasn't been wired into Doppler.

declare const Deno: { env: { get: (k: string) => string | undefined } };

export function publicUrl(): string {
  return Deno.env.get('KIZUNA_PUBLIC_URL') ?? 'http://localhost:5173';
}
