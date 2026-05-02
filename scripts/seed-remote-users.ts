#!/usr/bin/env -S tsx
/**
 * scripts/seed-remote-users.ts — TEMPORARY launch-window utility.
 *
 * Goes through every fictional employee in the sample fixtures and
 * (re-)creates a hosted Supabase auth user for them via the Admin API.
 * The bulk of the seed (auth.users INSERTs from
 * supabase/fixtures/01_sample_employees.sql) lands the rows but
 * hosted GoTrue refuses to authenticate them with the SQL-inserted
 * bcrypt hash — the password hash format the platform's auth
 * service expects is opaque, and the only reliable path is the
 * Admin API.
 *
 * Usage:
 *   tsx scripts/seed-remote-users.ts            # defaults to --config stg
 *   tsx scripts/seed-remote-users.ts prd
 *
 * Requires (in the chosen Doppler config):
 *   VITE_SUPABASE_URL
 *   SB_SECRET_KEY  (the project's service-role key)
 *
 * Doppler reserves the SUPABASE_ prefix for its native sync target,
 * so we use SB_ for the secrets we own.
 *
 * Idempotent: if a user already exists, we update their password and
 * confirm their email instead of failing. Delete this script before
 * the real launch — production users come in via Okta SSO, not this.
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const config = process.argv[2] ?? 'stg';
if (config !== 'stg' && config !== 'prd') {
  console.error('first argument must be one of: prd, stg');
  process.exit(64);
}

function dopplerSecret(name: string): string {
  try {
    // execFile (vs exec) avoids shell injection. All args are
    // hardcoded here, but the pattern is the right default.
    const value = execFileSync(
      'doppler',
      ['secrets', 'get', name, '--project', 'kizuna', '--config', config, '--plain'],
      { encoding: 'utf8' },
    ).trim();
    if (!value) throw new Error(`empty value for ${name}`);
    return value;
  } catch (err) {
    console.error(`Failed to read ${name} from Doppler config ${config}:`, (err as Error).message);
    process.exit(78);
  }
}

const supabaseUrl = dopplerSecret('VITE_SUPABASE_URL');
const serviceKey = dopplerSecret('SB_SECRET_KEY');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEV_PASSWORD = 'kizuna-dev-only';

/** Mirrors the names in supabase/fixtures/01_sample_employees.sql. */
const SAMPLE_USERS: ReadonlyArray<{ email: string; name: string }> = [
  // Star Trek leadership
  { email: 'jean-luc.picard@kizuna.dev', name: 'Jean-Luc Picard' },
  { email: 'kathryn.janeway@kizuna.dev', name: 'Kathryn Janeway' },
  { email: 'benjamin.sisko@kizuna.dev', name: 'Benjamin Sisko' },
  { email: 'jonathan.archer@kizuna.dev', name: 'Jonathan Archer' },
  { email: 'james.kirk@kizuna.dev', name: 'James Kirk' },
  // Star Wars engineering
  { email: 'luke.skywalker@kizuna.dev', name: 'Luke Skywalker' },
  { email: 'leia.organa@kizuna.dev', name: 'Leia Organa' },
  { email: 'han.solo@kizuna.dev', name: 'Han Solo' },
  { email: 'rey.skywalker@kizuna.dev', name: 'Rey' },
  { email: 'finn.fn2187@kizuna.dev', name: 'Finn' },
  { email: 'poe.dameron@kizuna.dev', name: 'Poe Dameron' },
  // Harry Potter marketing
  { email: 'harry.potter@kizuna.dev', name: 'Harry Potter' },
  { email: 'hermione.granger@kizuna.dev', name: 'Hermione Granger' },
  { email: 'ron.weasley@kizuna.dev', name: 'Ron Weasley' },
  // BSG sales
  { email: 'bill.adama@kizuna.dev', name: 'Bill Adama' },
  // Simpsons support
  { email: 'homer.simpson@kizuna.dev', name: 'Homer Simpson' },
];

async function ensureUser(email: string, name: string): Promise<void> {
  // Walk every paginated page so we don't miss a user past page 1.
  let target: { id: string } | undefined;
  let page = 1;
  while (!target) {
    const next = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (next.error) throw next.error;
    const users = next.data?.users ?? [];
    target = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (users.length === 0) break;
    page += 1;
  }

  if (target) {
    const { error } = await admin.auth.admin.updateUserById(target.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    console.log(`updated ${email}`);
    return;
  }
  const { error } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  console.log(`created ${email}`);
}

async function main(): Promise<void> {
  console.log(`Seeding ${SAMPLE_USERS.length} dev users on ${config} (${supabaseUrl})...`);
  for (const u of SAMPLE_USERS) {
    try {
      await ensureUser(u.email, u.name);
    } catch (err) {
      console.error(`failed for ${u.email}:`, (err as Error).message);
    }
  }
  console.log('Done. Every user now signs in with password "kizuna-dev-only".');
}

void main();
