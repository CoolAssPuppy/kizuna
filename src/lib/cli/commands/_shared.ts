// Cross-command helpers: active event lookup, name flattening, date
// math. Kept in one place so per-command files stay short and focused.

import type { CommandContext, CommandRole } from '../context.ts';
import type { CommandScope } from '../registry.ts';

export type MaybeArray<T> = T | T[] | null | undefined;

export function first<T>(value: MaybeArray<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function guestName(
  guest: { first_name: string; last_name: string } | null | undefined,
): string | null {
  if (!guest) return null;
  return `${guest.first_name} ${guest.last_name}`.trim();
}

export interface ActiveEventRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string | null;
  is_active: boolean;
}

export async function getActiveEvent(ctx: CommandContext): Promise<ActiveEventRow> {
  const { data, error } = await ctx.supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .eq('type', 'supafest')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(ctx.t('cli.errors.noActiveEvent'));
  return data;
}

export async function getEventById(ctx: CommandContext, id: string): Promise<ActiveEventRow> {
  const { data, error } = await ctx.supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(ctx.t('cli.errors.eventNotFound'));
  return data;
}

/**
 * Convert a `--day N` flag (1-indexed within the event window) into an
 * ISO date string. Returns undefined if `day` is unset.
 */
export function dayToDate(startDate: string, day?: number): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Build the half-open `[start, end)` ISO range for a single calendar
 * day, in UTC. Used for filtering itinerary/sessions to a specific
 * date.
 */
export function dayBounds(date: string): { start: string; end: string } {
  return { start: `${date}T00:00:00.000Z`, end: `${date}T23:59:59.999Z` };
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function roleToScope(role: CommandRole): CommandScope {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'user';
}
