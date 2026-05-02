import type { TFunction } from 'i18next';

import type { AppSupabaseClient } from '@/lib/supabase';
import type { AppUser } from '@/features/auth/types';

export type CommandRole = 'attendee' | 'admin' | 'super_admin';

export interface CommandContext {
  supabase: AppSupabaseClient;
  user: AppUser;
  role: CommandRole;
  t: TFunction;
  signal: AbortSignal;
}
