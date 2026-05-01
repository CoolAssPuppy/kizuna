import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { flatJoin, getSupabaseClient } from '@/lib/supabase';

import { pickIcebreakerTarget, reframeAsTeammateQuestion } from './icebreaker';

interface EmployeeProfileFields {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  legal_name: string | null;
  avatar_url: string | null;
}

interface IcebreakerCandidate {
  user_id: string;
  fun_fact: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

/**
 * "Get to know your teammate" home card. Picks one fellow attendee
 * with a fun_fact on mount, reframes it as "Which teammate ___?", and
 * exposes a Reveal-the-answer toggle. "Try another" rolls a fresh
 * candidate. The list of candidates excludes the viewer themselves so
 * the card never asks them to identify themselves.
 *
 * The rephrasing is local + deterministic. A future enhancement can
 * route the fact through a cheap edge-function (gpt-4o-mini) for
 * better grammar; the offline path here keeps the card working without
 * any backend round-trip.
 */
export function TeammateIcebreaker(): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [revealed, setRevealed] = useState(false);

  const { data: candidates } = useQuery<IcebreakerCandidate[]>({
    queryKey: ['icebreaker-candidates', user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('attendee_profiles')
        .select(
          'user_id, fun_fact, user:users!attendee_profiles_user_id_fkey ( email, employee_profiles ( preferred_name, first_name, last_name, legal_name, avatar_url ) )',
        )
        .not('fun_fact', 'is', null);
      if (error) throw error;
      type UserRel = {
        email: string;
        employee_profiles: EmployeeProfileFields | Array<EmployeeProfileFields> | null;
      };
      type Row = {
        user_id: string;
        fun_fact: string | null;
        user: UserRel | Array<UserRel> | null;
      };
      const rows = (data ?? []) as unknown as Row[];
      return rows
        .filter((row) => row.user_id !== user?.id)
        .map((row): IcebreakerCandidate => {
          const userRel = flatJoin(row.user);
          const profile = flatJoin(userRel?.employee_profiles ?? null);
          const composedName = profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            : '';
          const name =
            profile?.preferred_name ??
            profile?.legal_name ??
            (composedName.length > 0 ? composedName : null) ??
            userRel?.email ??
            '';
          return {
            user_id: row.user_id,
            fun_fact: row.fun_fact,
            full_name: name,
            email: userRel?.email ?? '',
            avatar_url: profile?.avatar_url ?? null,
          };
        });
    },
  });

  const target = useMemo(() => pickIcebreakerTarget(candidates ?? [], seed), [candidates, seed]);

  if (!target) return null;

  const question = reframeAsTeammateQuestion(target.fun_fact ?? '');
  const initials = (target.full_name || target.email)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <CardShell title={t('home.icebreaker.title')} description={t('home.icebreaker.subtitle')}>
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Sparkles aria-hidden className="mt-0.5 h-4 w-4 text-primary" />
          <p className="text-sm font-medium leading-relaxed">{question}</p>
        </div>
        {revealed ? (
          <div className="flex items-center gap-3 rounded-md border bg-card p-3">
            <Avatar url={target.avatar_url} fallback={initials} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{target.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{target.email}</p>
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setRevealed(true)}>
            {t('home.icebreaker.reveal')}
          </Button>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSeed(Date.now() + Math.random());
              setRevealed(false);
            }}
          >
            {t('home.icebreaker.tryAnother')}
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
