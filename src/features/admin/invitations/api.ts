import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type EventInvitationRow = Database['public']['Tables']['event_invitations']['Row'];
export type EventInvitationInsert = Database['public']['Tables']['event_invitations']['Insert'];

export interface InvitationDraft {
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Lists every invitation for an event, ordered alphabetically. The
 * admin screen renders this as a table with delete affordances.
 */
export async function listInvitations(
  client: AppSupabaseClient,
  eventId: string,
): Promise<EventInvitationRow[]> {
  const { data, error } = await client
    .from('event_invitations')
    .select('*')
    .eq('event_id', eventId)
    .order('email', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface BulkAddResult {
  inserted: number;
  /** Rows we silently skipped because they already exist for this event. */
  skipped_duplicates: number;
  /** Rows that failed format validation client-side. Server-rejected
   *  rows surface as a thrown error from this function. */
  rejected_invalid: number;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Inserts the supplied drafts in one round-trip, deduping against the
 * passed-in `existingEmails` set. Returns the count of new rows so the
 * caller can show "X added, Y skipped" feedback.
 */
export async function addInvitations(
  client: AppSupabaseClient,
  args: {
    eventId: string;
    drafts: ReadonlyArray<InvitationDraft>;
    existingEmails: ReadonlyArray<string>;
    invitedBy: string;
  },
): Promise<BulkAddResult> {
  const { eventId, drafts, existingEmails, invitedBy } = args;
  const existingLower = new Set(existingEmails.map((e) => e.toLowerCase()));
  const seenInBatch = new Set<string>();
  const toInsert: EventInvitationInsert[] = [];
  let rejectedInvalid = 0;
  let skippedDuplicates = 0;

  for (const draft of drafts) {
    const email = draft.email.trim().toLowerCase();
    const first = draft.first_name.trim();
    const last = draft.last_name.trim();
    if (!email || !first || !last || !EMAIL_RE.test(email)) {
      rejectedInvalid += 1;
      continue;
    }
    if (existingLower.has(email) || seenInBatch.has(email)) {
      skippedDuplicates += 1;
      continue;
    }
    seenInBatch.add(email);
    toInsert.push({
      event_id: eventId,
      email,
      first_name: first,
      last_name: last,
      invited_by: invitedBy,
    });
  }

  if (toInsert.length === 0) {
    return {
      inserted: 0,
      skipped_duplicates: skippedDuplicates,
      rejected_invalid: rejectedInvalid,
    };
  }

  const { error } = await client.from('event_invitations').insert(toInsert);
  if (error) throw error;

  return {
    inserted: toInsert.length,
    skipped_duplicates: skippedDuplicates,
    rejected_invalid: rejectedInvalid,
  };
}

export async function deleteInvitation(
  client: AppSupabaseClient,
  args: { eventId: string; email: string },
): Promise<void> {
  const { error } = await client
    .from('event_invitations')
    .delete()
    .eq('event_id', args.eventId)
    .eq('email', args.email);
  if (error) throw error;
}
