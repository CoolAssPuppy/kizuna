import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';

import { markTaskComplete } from '../api';
import type { RegistrationTaskKey } from '../types';
import type { SectionMode } from './types';

interface UseSectionSubmitOptions {
  mode: SectionMode;
  /** Registration task to mark complete after save. Skip when none applies (e.g. children). */
  taskKey: RegistrationTaskKey | null;
  /** i18n key for the success toast shown in profile mode. */
  toastSuccessKey: string;
  /**
   * Query keys to invalidate after a successful save. Without this the
   * 30s staleTime + cached row mean the user sees their pre-save values
   * the next time they mount the section, which reads as "save didn't
   * work." Pass the same keys the section's useQuery uses.
   */
  invalidateQueryKeys?: ReadonlyArray<QueryKey>;
}

interface SubmitState {
  busy: boolean;
  errorKey: string | null;
  /** Wraps a save() function with the right post-save side effects. */
  submit: (save: () => Promise<void>) => Promise<void>;
}

/**
 * Centralises the "save then react" logic shared by every Section:
 *  - wizard mode → mark task complete + advance to next step
 *  - profile mode → show success toast
 *
 * Returns the busy/error state too so each Section doesn't reinvent it.
 */
export function useSectionSubmit({
  mode,
  taskKey,
  toastSuccessKey,
  invalidateQueryKeys,
}: UseSectionSubmitOptions): SubmitState {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function submit(save: () => Promise<void>): Promise<void> {
    setBusy(true);
    setErrorKey(null);
    try {
      await save();
      if (mode.kind === 'wizard') {
        if (taskKey) {
          await markTaskComplete(getSupabaseClient(), mode.bundle.registration.id, taskKey);
        }
        mode.onComplete();
      } else if (mode.kind === 'profile' && taskKey) {
        // Profile-mode saves should also tick off the registration task
        // so users who skip the wizard still see their checklist progress.
        // We don't have the registration bundle in profile mode, so we
        // call a SECURITY DEFINER helper that resolves the active
        // registration for the caller.
        try {
          const { error } = await getSupabaseClient().rpc(
            'mark_my_registration_task_complete',
            { p_task_key: taskKey },
          );
          if (error) throw error;
        } catch (err) {
          console.error('[kizuna] markTaskComplete (profile) failed', err);
        }
      }
      if (invalidateQueryKeys && invalidateQueryKeys.length > 0) {
        await Promise.all(
          invalidateQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      }
      // Always invalidate the profile checklist after a save so the
      // sidebar updates whether or not the section explicitly opts in.
      await queryClient.invalidateQueries({ queryKey: ['profile', 'checklist'] });
      // Every Save click emits a toast — see useSectionSubmit.test.tsx.
      show(t(toastSuccessKey));
    } catch (err) {
      console.error('[kizuna] section save failed', err);
      show(t('profile.toast.error'), 'error');
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return { busy, errorKey, submit };
}
