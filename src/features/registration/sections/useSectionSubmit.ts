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
}: UseSectionSubmitOptions): SubmitState {
  const { t } = useTranslation();
  const { show } = useToast();
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
      }
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
