import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { SectionChrome } from '@/features/registration/sections/SectionChrome';
import type { SectionProps } from '@/features/registration/sections/types';
import { useSectionSubmit } from '@/features/registration/sections/useSectionSubmit';
import { getSupabaseClient } from '@/lib/supabase';

import {
  loadCommunityProfile,
  loadHobbyCatalog,
  saveCommunityProfile,
} from './api';
import { COUNTRIES, isValidCountryCode } from './countries';

interface FormState {
  bio: string;
  funFact: string;
  hobbies: string[];
  hobbyDraft: string;
  hometownCity: string;
  hometownCountry: string;
  currentCity: string;
  currentCountry: string;
}

const EMPTY: FormState = {
  bio: '',
  funFact: '',
  hobbies: [],
  hobbyDraft: '',
  hometownCity: '',
  hometownCountry: '',
  currentCity: '',
  currentCountry: '',
};

export function CommunityProfileSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: null,
    toastSuccessKey: 'community.profile.saved',
  });

  const profileQuery = useQuery({
    queryKey: ['community', 'profile', user?.id],
    queryFn: () => loadCommunityProfile(getSupabaseClient(), user!.id),
    enabled: !!user,
  });
  const catalogQuery = useQuery({
    queryKey: ['community', 'hobbyCatalog'],
    queryFn: () => loadHobbyCatalog(getSupabaseClient()),
  });
  const hobbyCatalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const hydrated = hydratedFor === user?.id;

  // Hydrate the form once per user from the query result. We cannot
  // derive form state directly because the user edits it; the query
  // is the seed, not the live source.
  useEffect(() => {
    if (!user || !profileQuery.data || hydratedFor === user.id) return;
    const row = profileQuery.data;
    setValues({
      bio: row.bio ?? '',
      funFact: row.fun_fact ?? '',
      hobbies: row.hobbies,
      hobbyDraft: '',
      hometownCity: row.hometown_city ?? '',
      hometownCountry: row.hometown_country ?? '',
      currentCity: row.current_city ?? '',
      currentCountry: row.current_country ?? '',
    });
    setHydratedFor(user.id);
  }, [user, profileQuery.data, hydratedFor]);

  // Suggestions are derived from the current draft + catalog: pure
  // computation, no effect needed.
  const suggestions = useMemo(() => {
    const draft = values.hobbyDraft.toLowerCase().trim();
    if (!draft) return [];
    const taken = new Set(values.hobbies);
    return hobbyCatalog
      .filter(
        (h) =>
          !taken.has(h.slug)
          && (h.label.toLowerCase().includes(draft) || h.slug.includes(draft)),
      )
      .slice(0, 6);
  }, [hobbyCatalog, values.hobbies, values.hobbyDraft]);

  function addHobby(label: string): void {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug.length < 2 || slug.length > 40) return;
    setValues((v) =>
      v.hobbies.includes(slug) ? v : { ...v, hobbies: [...v.hobbies, slug], hobbyDraft: '' },
    );
  }

  function removeHobby(slug: string): void {
    setValues((v) => ({ ...v, hobbies: v.hobbies.filter((h) => h !== slug) }));
  }

  function hobbyLabel(slug: string): string {
    const found = hobbyCatalog.find((h) => h.slug === slug);
    if (found) return found.label;
    return slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  function handleSubmit(): void {
    if (!user) return;
    void submit(async () => {
      await saveCommunityProfile(getSupabaseClient(), user.id, {
        bio: values.bio.trim() || null,
        fun_fact: values.funFact.trim() || null,
        hobbies: values.hobbies,
        hometown_city: values.hometownCity.trim() || null,
        hometown_country: isValidCountryCode(values.hometownCountry)
          ? values.hometownCountry.toUpperCase()
          : null,
        current_city: values.currentCity.trim() || null,
        current_country: isValidCountryCode(values.currentCountry)
          ? values.currentCountry.toUpperCase()
          : null,
      });
      // Bust the cached profile + the people list that drives the
      // community page so the next mount sees the saved values without
      // a hard refresh.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['community', 'profile', user.id] }),
        qc.invalidateQueries({ queryKey: ['community', 'people'] }),
      ]);
    });
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('community.profile.title')}
      {...(mode.kind === 'profile' ? { description: t('community.profile.description') } : {})}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="community-bio">{t('community.profile.bio')}</Label>
        <Textarea
          id="community-bio"
          rows={3}
          value={values.bio}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          placeholder={t('community.profile.bioPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="community-fun-fact">{t('community.profile.funFact')}</Label>
        <Input
          id="community-fun-fact"
          value={values.funFact}
          onChange={(e) => setValues((v) => ({ ...v, funFact: e.target.value }))}
          placeholder={t('community.profile.funFactPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="community-hobbies">{t('community.profile.hobbies')}</Label>
        {values.hobbies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {values.hobbies.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs"
              >
                {hobbyLabel(slug)}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => removeHobby(slug)}
                  aria-label={t('community.profile.removeHobby', { hobby: hobbyLabel(slug) })}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <Input
          id="community-hobbies"
          value={values.hobbyDraft}
          onChange={(e) => setValues((v) => ({ ...v, hobbyDraft: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (values.hobbyDraft.trim()) addHobby(values.hobbyDraft.trim());
            }
          }}
          placeholder={t('community.profile.hobbiesPlaceholder')}
        />
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((h) => (
              <button
                key={h.slug}
                type="button"
                onClick={() => addHobby(h.label)}
                className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {h.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-2">
          <Label htmlFor="community-hometown-city">
            {t('community.profile.hometownCity')}
          </Label>
          <Input
            id="community-hometown-city"
            value={values.hometownCity}
            onChange={(e) => setValues((v) => ({ ...v, hometownCity: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-hometown-country">
            {t('community.profile.country')}
          </Label>
          <CountrySelect
            id="community-hometown-country"
            value={values.hometownCountry}
            onChange={(next) => setValues((v) => ({ ...v, hometownCountry: next }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-2">
          <Label htmlFor="community-current-city">
            {t('community.profile.currentCity')}
          </Label>
          <Input
            id="community-current-city"
            value={values.currentCity}
            onChange={(e) => setValues((v) => ({ ...v, currentCity: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-current-country">
            {t('community.profile.country')}
          </Label>
          <CountrySelect
            id="community-current-country"
            value={values.currentCountry}
            onChange={(next) => setValues((v) => ({ ...v, currentCountry: next }))}
          />
        </div>
      </div>
    </SectionChrome>
  );
}

interface CountrySelectProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
}

function CountrySelect({ id, value, onChange }: CountrySelectProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{t('community.profile.country')}</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
