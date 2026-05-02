/**
 * Local realtime simulation for the community channels.
 *
 * Signs in as a handful of seeded employees and posts realistic chat
 * snippets at human cadence so the realtime + typing presence indicators
 * can be validated visually. Safe to run repeatedly — every message is a
 * new row but the dev DB is throw-away.
 *
 * Run with:
 *   npx tsx scripts/simulate-community.ts
 *
 * Defaults: 8 conversation rounds across 5 channels with random pauses.
 * Override via env: ROUNDS=20 SLEEP_MIN_MS=500 SLEEP_MAX_MS=4000.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../src/types/database.types';

const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
const SUPABASE_PUBLISHABLE_KEY =
  process.env['VITE_SUPABASE_PUBLISHABLE_KEY']
  ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const PASSWORD = 'kizuna-dev-only';
const ROUNDS = Number(process.env.ROUNDS ?? '8');
const SLEEP_MIN_MS = Number(process.env.SLEEP_MIN_MS ?? '600');
const SLEEP_MAX_MS = Number(process.env.SLEEP_MAX_MS ?? '3500');

interface Speaker {
  email: string;
  client: SupabaseClient<Database>;
  userId: string;
  displayName: string;
}

interface Snippet {
  channel: string;
  email: string;
  body: string;
}

const SCRIPT: Snippet[] = [
  { channel: 'general', email: 'jean-luc.picard@kizuna.dev', body: 'Welcome to **Banff**, everyone. Make it so.' },
  { channel: 'general', email: 'kathryn.janeway@kizuna.dev', body: 'Coffee, black. There had better be coffee.' },
  { channel: 'ski-snowboard', email: 'luke.skywalker@kizuna.dev', body: 'Powder day at Lake Louise. _Reckless flying is not tolerated._' },
  { channel: 'ski-snowboard', email: 'leia.organa@kizuna.dev', body: "I'm in. Bring an extra hand warmer." },
  { channel: 'ski-snowboard', email: 'han.solo@kizuna.dev', body: "I've got a bad feeling about this gondola." },
  { channel: 'coffee-and-life', email: 'kathryn.janeway@kizuna.dev', body: 'Banff Roasting Co. has flat whites. __Highly recommend__.' },
  { channel: 'coffee-and-life', email: 'rey.skywalker@kizuna.dev', body: 'I just want a tea. Anything green.' },
  { channel: 'photo-walk', email: 'harry.potter@kizuna.dev', body: 'Sunrise at Vermillion Lakes. 6:15 lobby.' },
  { channel: 'photo-walk', email: 'luna.lovegood@kizuna.dev', body: 'I think I saw a Snorkack out there yesterday.' },
  { channel: 'engineering-banter', email: 'obi-wan.kenobi@kizuna.dev', body: 'Postgres haiku: indexes / scan only when truly needed / vacuum is the way' },
  { channel: 'engineering-banter', email: 'mace.windu@kizuna.dev', body: "This party's over." },
  { channel: 'books', email: 'hermione.granger@kizuna.dev', body: 'Currently reading: _Project Hail Mary_. Recommend.' },
  { channel: 'books', email: 'minerva.mcgonagall@kizuna.dev', body: 'I prefer Transfiguration Today, but it is a niche read.' },
  { channel: 'general', email: 'rubeus.hagrid@kizuna.dev', body: "Don't forget your boots — it's brisk out there." },
  { channel: 'ski-snowboard', email: 'ahsoka.tano@kizuna.dev', body: 'Snow conditions look great today. https://avalanche.ca/forecasts' },
  { channel: 'general', email: 'jean-luc.picard@kizuna.dev', body: 'Engage.' },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authenticate(email: string): Promise<Speaker> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) {
    throw new Error(`auth failed for ${email}: ${error?.message ?? 'no user'}`);
  }
  const { data: profile } = await client
    .from('employee_profiles')
    .select('preferred_name')
    .eq('user_id', data.user.id)
    .maybeSingle();
  return {
    email,
    client,
    userId: data.user.id,
    displayName: profile?.preferred_name ?? email.split('@')[0] ?? email,
  };
}

async function emitTyping(speaker: Speaker, channelSlug: string): Promise<void> {
  const presence = speaker.client.channel(`community-typing:${channelSlug}`, {
    config: { presence: { key: speaker.userId } },
  });
  await new Promise<void>((resolve) => {
    presence.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });
  await presence.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: speaker.userId, displayName: speaker.displayName },
  });
  await sleep(800);
  await speaker.client.removeChannel(presence);
}

async function postSnippet(speakers: Map<string, Speaker>, snippet: Snippet): Promise<void> {
  const speaker = speakers.get(snippet.email);
  if (!speaker) {
    console.warn(`skipping snippet — no speaker for ${snippet.email}`);
    return;
  }
  await emitTyping(speaker, snippet.channel);
  const { error } = await speaker.client.from('messages').insert({
    sender_id: speaker.userId,
    channel: snippet.channel,
    body: snippet.body,
  });
  if (error) {
    console.error(`message insert failed for ${snippet.email}:`, error.message);
  } else {
    console.log(`#${snippet.channel} <${speaker.displayName}> ${snippet.body}`);
  }
}

async function main(): Promise<void> {
  const uniqueEmails = Array.from(new Set(SCRIPT.map((s) => s.email)));
  console.log(`signing in as ${uniqueEmails.length} sample users…`);
  const speakerEntries = await Promise.all(
    uniqueEmails.map(async (email) => [email, await authenticate(email)] as const),
  );
  const speakers = new Map(speakerEntries);

  console.log(`replaying ${SCRIPT.length} snippets across ${ROUNDS} rounds…`);
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const snippet of SCRIPT) {
      await postSnippet(speakers, snippet);
      await sleep(randomBetween(SLEEP_MIN_MS, SLEEP_MAX_MS));
    }
    console.log(`— round ${round + 1} of ${ROUNDS} done`);
  }

  await Promise.all([...speakers.values()].map((s) => s.client.auth.signOut()));
  console.log('done');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
