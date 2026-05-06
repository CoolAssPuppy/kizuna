import { utcIsoToZonedDateTimeLocal } from '@/lib/timezone';

import type { SessionAudience, SessionRow, SessionStatus, SessionType } from '../api/sessions';

export interface SessionDraft {
  id?: string;
  title: string;
  subtitle: string;
  type: SessionType;
  audience: SessionAudience;
  status: SessionStatus;
  /** Wall-clock "YYYY-MM-DDTHH:mm" in the event's timezone. */
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: string;
  is_mandatory: boolean;
  abstract: string;
  speaker_email: string;
  tag_ids: string[];
}

const EMPTY_DRAFT: SessionDraft = {
  title: '',
  subtitle: '',
  type: 'breakout',
  audience: 'all',
  status: 'active',
  starts_at: '',
  ends_at: '',
  location: '',
  capacity: '',
  is_mandatory: false,
  abstract: '',
  speaker_email: '',
  tag_ids: [],
};

function fromIso(value: string | null, timeZone: string): string {
  if (!value) return '';
  return utcIsoToZonedDateTimeLocal(value, timeZone);
}

export function rowToDraft(
  row: SessionRow,
  timeZone: string,
  tagIds: ReadonlyArray<string> = [],
): SessionDraft {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    type: row.type,
    audience: row.audience,
    status: row.status,
    starts_at: fromIso(row.starts_at, timeZone),
    ends_at: fromIso(row.ends_at, timeZone),
    location: row.location ?? '',
    capacity: row.capacity != null ? String(row.capacity) : '',
    is_mandatory: row.is_mandatory,
    abstract: row.abstract ?? '',
    speaker_email: row.speaker_email ?? '',
    tag_ids: [...tagIds],
  };
}

export function emptySessionDraft(): SessionDraft {
  return { ...EMPTY_DRAFT, tag_ids: [] };
}
