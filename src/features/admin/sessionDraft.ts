import type { SessionAudience, SessionRow, SessionType } from './api/sessions';

export interface SessionDraft {
  id?: string;
  title: string;
  subtitle: string;
  type: SessionType;
  audience: SessionAudience;
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: string;
  is_mandatory: boolean;
  abstract: string;
  speaker_email: string;
}

const EMPTY_DRAFT: SessionDraft = {
  title: '',
  subtitle: '',
  type: 'breakout',
  audience: 'all',
  starts_at: '',
  ends_at: '',
  location: '',
  capacity: '',
  is_mandatory: false,
  abstract: '',
  speaker_email: '',
};

function fromIso(value: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

export function rowToDraft(row: SessionRow): SessionDraft {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    type: row.type,
    audience: row.audience,
    starts_at: fromIso(row.starts_at),
    ends_at: fromIso(row.ends_at),
    location: row.location ?? '',
    capacity: row.capacity != null ? String(row.capacity) : '',
    is_mandatory: row.is_mandatory,
    abstract: row.abstract ?? '',
    speaker_email: row.speaker_email ?? '',
  };
}

export function emptySessionDraft(): SessionDraft {
  return { ...EMPTY_DRAFT };
}
