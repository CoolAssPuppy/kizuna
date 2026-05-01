import { useTranslation } from 'react-i18next';

import { COUNTRIES } from '@/features/community/countries';

interface CountrySelectProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Override the placeholder option text. Defaults to the community country label. */
  placeholderKey?: string;
  required?: boolean;
}

/**
 * Standard country dropdown used wherever Kizuna captures an ISO-3166
 * country code (community profile hometown / current city, passport
 * issuing country). Backed by the shared COUNTRIES list so the option
 * set stays in sync across surfaces.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  placeholderKey,
  required,
}: CountrySelectProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{t(placeholderKey ?? 'community.profile.country')}</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
