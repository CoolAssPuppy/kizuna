#!/usr/bin/env -S tsx
/**
 * scripts/seed-test-storage.ts — uploads the placeholder swag images
 * from public/test-images/ into the local event-content bucket and
 * stamps the resulting paths onto the seeded swag_items rows.
 *
 * Local-only by design. Production swag images come from real admin
 * uploads via /admin/swag, so we never want this script touching prod.
 * Idempotent: re-running overwrites object bytes (upsert: true) and
 * the SQL UPDATE is a no-op when the path is already correct.
 *
 * Run after `bash scripts/db-apply.sh`. Both scripts together get a
 * fresh local DB to a state where the demo has a populated swag tab.
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
// Local-only key shipped by `supabase start`. Same value baked into
// scripts/with-doppler.sh's local fallback.
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SwagSeed {
  /** Substring matched against swag_items.name to pick the row. */
  match: string;
  /** Filename inside public/test-images/. */
  cover: string;
  /** Optional sizing-chart filename inside public/test-images/. */
  sizing?: string;
}

const SEEDS: ReadonlyArray<SwagSeed> = [
  { match: 'Picard', cover: 'swag-picard-uniform.png', sizing: 'swag-size-chart.png' },
  { match: 'Bat', cover: 'swag-batleth.png' },
  { match: 'Banff', cover: 'swag-banff-jacket.svg', sizing: 'swag-size-chart.png' },
  { match: 'Tote', cover: 'swag-engineering-tote.svg' },
  { match: 'Mug', cover: 'swag-subspace-mug.svg' },
];

function contentTypeFor(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function uploadOne(eventId: string, itemId: string, kind: 'cover' | 'sizing', filename: string): Promise<string> {
  const objectPath = `${eventId}/swag/${itemId}/${kind}${extname(filename)}`;
  const bytes = readFileSync(`public/test-images/${filename}`);
  const { error } = await supabase.storage.from('event-content').upload(objectPath, bytes, {
    contentType: contentTypeFor(filename),
    upsert: true,
  });
  if (error) throw new Error(`upload ${objectPath}: ${error.message}`);
  return objectPath;
}

async function main(): Promise<void> {
  const events = await supabase.from('events').select('id').eq('is_active', true).limit(1);
  if (events.error) throw events.error;
  const eventId = events.data?.[0]?.id;
  if (!eventId) {
    console.warn('no active event — skipping swag seed');
    return;
  }

  const items = await supabase
    .from('swag_items')
    .select('id, name')
    .eq('event_id', eventId);
  if (items.error) throw items.error;

  let touched = 0;
  for (const seed of SEEDS) {
    const item = items.data?.find((row) => row.name.includes(seed.match));
    if (!item) {
      console.warn(`no swag_items row matched "${seed.match}" — skipping`);
      continue;
    }
    const coverPath = await uploadOne(eventId, item.id, 'cover', seed.cover);
    const patch: { image_path: string; size_image_path?: string } = { image_path: coverPath };
    if (seed.sizing) {
      patch.size_image_path = await uploadOne(eventId, item.id, 'sizing', seed.sizing);
    }
    const { error } = await supabase.from('swag_items').update(patch).eq('id', item.id);
    if (error) throw error;
    touched += 1;
    console.log(`stamped ${item.name} -> ${coverPath}`);
  }
  console.log(`seeded ${touched} swag items`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
