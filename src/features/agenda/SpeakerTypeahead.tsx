import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Suggestion {
  user_id: string;
  email: string;
  display_name: string;
}

interface Props {
  eventId: string;
  /** Current speaker_email value. */
  value: string;
  /** Called with the email when the user types or picks a suggestion. */
  onChange: (email: string) => void;
  inputId: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SpeakerTypeahead({
  eventId,
  value,
  onChange,
  inputId,
  placeholder,
  disabled,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const debouncedValue = useDebouncedValue(value, 200);

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', 'speaker-typeahead', eventId, debouncedValue],
    enabled: !disabled && Boolean(eventId),
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await getSupabaseClient().rpc('list_event_attendees_for_typeahead', {
        p_event_id: eventId,
        p_query: debouncedValue,
        p_limit: 20,
      });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const suggestions = data ?? [];
  const showPanel = open && !disabled;

  return (
    <div className="relative">
      <Input
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so click handlers on suggestions can fire first.
          setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      {showPanel ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md',
          )}
        >
          {isLoading && suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t('agenda.speakerTypeahead.loading')}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t('agenda.speakerTypeahead.empty')}
            </p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.user_id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                onMouseDown={(e) => {
                  // Prevent input blur before click resolves.
                  e.preventDefault();
                }}
                onClick={() => {
                  onChange(s.email);
                  setOpen(false);
                }}
              >
                <span className="font-medium leading-tight">{s.display_name}</span>
                <span className="text-xs leading-tight text-muted-foreground">{s.email}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
