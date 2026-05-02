import { STORAGE_BUCKETS } from '@/lib/storageBuckets';
import { type AppSupabaseClient, flatJoin, type Joined } from '@/lib/supabase';

import type { GalleryQuery } from './searchQuery';

export const PHOTOS_BUCKET = STORAGE_BUCKETS.communityMedia;

export interface PhotoTaggedPerson {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface PhotoUploader {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface PhotoRecord {
  id: string;
  event_id: string;
  uploader_id: string;
  storage_prefix: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  uploader: PhotoUploader | null;
  hashtags: string[];
  tagged: PhotoTaggedPerson[];
}

interface UserRow {
  id: string;
  email: string;
  employee_profiles: Joined<{
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    legal_name: string | null;
    avatar_url: string | null;
  }>;
  guest_profiles: Joined<{ first_name: string; last_name: string }>;
}

interface RawPhotoRow {
  id: string;
  event_id: string;
  uploader_id: string;
  storage_prefix: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  uploader: Joined<UserRow>;
  hashtags: { hashtag: string }[] | null;
  tags: { tagged_user: Joined<UserRow> }[] | null;
}

const PHOTO_SELECT = `
  id, event_id, uploader_id, storage_prefix, width, height, caption, created_at,
  uploader:users!event_photos_uploader_id_fkey (
    id, email,
    employee_profiles ( first_name, last_name, preferred_name, legal_name, avatar_url ),
    guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
  ),
  hashtags:event_photo_hashtags ( hashtag ),
  tags:event_photo_tags (
    tagged_user:users!event_photo_tags_tagged_user_id_fkey (
      id, email,
      employee_profiles ( first_name, last_name, preferred_name, legal_name, avatar_url ),
      guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
    )
  )
`;

function userToPerson(user: UserRow | null): PhotoTaggedPerson | null {
  if (!user) return null;
  const employee = flatJoin(user.employee_profiles);
  const guest = flatJoin(user.guest_profiles);
  return {
    user_id: user.id,
    first_name: employee?.first_name ?? guest?.first_name ?? null,
    last_name: employee?.last_name ?? guest?.last_name ?? null,
    email: user.email,
    avatar_url: employee?.avatar_url ?? null,
  };
}

function rawToRecord(raw: RawPhotoRow): PhotoRecord {
  const uploader = userToPerson(flatJoin(raw.uploader));
  const tagged: PhotoTaggedPerson[] = [];
  for (const tag of raw.tags ?? []) {
    const person = userToPerson(flatJoin(tag.tagged_user));
    if (person) tagged.push(person);
  }
  return {
    id: raw.id,
    event_id: raw.event_id,
    uploader_id: raw.uploader_id,
    storage_prefix: raw.storage_prefix,
    width: raw.width,
    height: raw.height,
    caption: raw.caption,
    created_at: raw.created_at,
    uploader,
    hashtags: (raw.hashtags ?? []).map((h) => h.hashtag),
    tagged,
  };
}

export async function loadRecentPhotos(
  client: AppSupabaseClient,
  eventId: string,
  limit = 20,
): Promise<PhotoRecord[]> {
  const { data, error } = await client
    .from('event_photos')
    .select(PHOTO_SELECT)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RawPhotoRow[]).map(rawToRecord);
}

export async function loadPhotoById(
  client: AppSupabaseClient,
  photoId: string,
): Promise<PhotoRecord | null> {
  const { data, error } = await client
    .from('event_photos')
    .select(PHOTO_SELECT)
    .eq('id', photoId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return rawToRecord(data as unknown as RawPhotoRow);
}

interface SearchPhotosArgs {
  eventId: string;
  query: GalleryQuery;
  limit?: number;
}

export async function searchPhotos(
  client: AppSupabaseClient,
  { eventId, query, limit = 60 }: SearchPhotosArgs,
): Promise<PhotoRecord[]> {
  if (query.kind === 'empty') {
    return loadRecentPhotos(client, eventId, limit);
  }

  if (query.kind === 'hashtag') {
    const { data: hits, error } = await client
      .from('event_photo_hashtags')
      .select('photo_id')
      .ilike('hashtag', `${query.value}%`);
    if (error) throw error;
    const ids = Array.from(new Set((hits ?? []).map((row) => row.photo_id)));
    if (ids.length === 0) return [];
    return loadPhotosByIds(client, eventId, ids, limit);
  }

  if (query.kind === 'mention') {
    const { data: users, error } = await client
      .from('users')
      .select('id')
      .or(`email.ilike.%${query.value}%`)
      .limit(50);
    if (error) throw error;
    const userIds = (users ?? []).map((u) => u.id);
    if (userIds.length === 0) return [];
    const { data: tagged, error: tagsError } = await client
      .from('event_photo_tags')
      .select('photo_id')
      .in('tagged_user_id', userIds);
    if (tagsError) throw tagsError;
    const ids = Array.from(new Set((tagged ?? []).map((t) => t.photo_id)));
    if (ids.length === 0) return [];
    return loadPhotosByIds(client, eventId, ids, limit);
  }

  // Free-text: match on caption ILIKE or hashtag ILIKE.
  const captionMatches = await client
    .from('event_photos')
    .select(PHOTO_SELECT)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .ilike('caption', `%${query.value}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (captionMatches.error) throw captionMatches.error;
  return ((captionMatches.data ?? []) as unknown as RawPhotoRow[]).map(rawToRecord);
}

async function loadPhotosByIds(
  client: AppSupabaseClient,
  eventId: string,
  photoIds: string[],
  limit: number,
): Promise<PhotoRecord[]> {
  const { data, error } = await client
    .from('event_photos')
    .select(PHOTO_SELECT)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .in('id', photoIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RawPhotoRow[]).map(rawToRecord);
}

export async function loadProfileActivity(
  client: AppSupabaseClient,
  userId: string,
  eventId: string,
  limit = 10,
): Promise<PhotoRecord[]> {
  // Photos uploaded by this user OR tagged with this user.
  const tagged = await client
    .from('event_photo_tags')
    .select('photo_id')
    .eq('tagged_user_id', userId);
  if (tagged.error) throw tagged.error;
  const taggedIds = (tagged.data ?? []).map((row) => row.photo_id);

  const { data, error } = await client
    .from('event_photos')
    .select(PHOTO_SELECT)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or(
      taggedIds.length > 0
        ? `uploader_id.eq.${userId},id.in.(${taggedIds.join(',')})`
        : `uploader_id.eq.${userId}`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RawPhotoRow[]).map(rawToRecord);
}

export async function softDeletePhoto(
  client: AppSupabaseClient,
  photoId: string,
): Promise<void> {
  const { error } = await client.rpc('soft_delete_event_photo', { p_photo_id: photoId });
  if (error) throw error;
}

export interface UploadPhotoArgs {
  eventId: string;
  uploaderId: string;
  original: File;
  preview: Blob;
  thumb: Blob;
  width: number;
  height: number;
  caption: string;
  taggedUserIds: ReadonlyArray<string>;
}

export async function uploadPhoto(
  client: AppSupabaseClient,
  args: UploadPhotoArgs,
): Promise<PhotoRecord> {
  const { eventId, uploaderId, original, preview, thumb, width, height, caption, taggedUserIds } = args;

  const ext = (original.name.split('.').pop() ?? 'jpg').toLowerCase();
  // Insert metadata first so we know the photo id; then write storage paths.
  const { data: photoRow, error: insertError } = await client
    .from('event_photos')
    .insert({
      event_id: eventId,
      uploader_id: uploaderId,
      storage_prefix: '', // placeholder; updated below
      width,
      height,
      caption: caption.trim() || null,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;

  const photoId = photoRow.id;
  const prefix = `${eventId}/gallery/${uploaderId}/${photoId}`;

  await Promise.all([
    client.storage.from(PHOTOS_BUCKET).upload(`${prefix}/original.${ext}`, original, {
      contentType: original.type || 'application/octet-stream',
      upsert: false,
    }),
    client.storage.from(PHOTOS_BUCKET).upload(`${prefix}/preview.webp`, preview, {
      contentType: 'image/webp',
      upsert: false,
    }),
    client.storage.from(PHOTOS_BUCKET).upload(`${prefix}/thumb.webp`, thumb, {
      contentType: 'image/webp',
      upsert: false,
    }),
  ]);

  const { error: prefixError } = await client
    .from('event_photos')
    .update({ storage_prefix: prefix })
    .eq('id', photoId);
  if (prefixError) throw prefixError;

  if (taggedUserIds.length > 0) {
    const rows = Array.from(new Set(taggedUserIds)).map((tagged_user_id) => ({
      photo_id: photoId,
      tagged_user_id,
    }));
    const { error: tagError } = await client.from('event_photo_tags').insert(rows);
    if (tagError) throw tagError;
  }

  const fetched = await loadPhotoById(client, photoId);
  if (!fetched) throw new Error('photo missing after upload');
  return fetched;
}

export interface AttendeeSearchResult {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

export async function searchAttendees(
  client: AppSupabaseClient,
  query: string,
  limit = 8,
): Promise<AttendeeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await client
    .from('attendee_profiles')
    .select(
      `
      user_id,
      user:users!attendee_profiles_user_id_fkey (
        id, email,
        employee_profiles ( first_name, last_name, preferred_name, legal_name, avatar_url ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .neq('visibility', 'private')
    .limit(limit * 4);
  if (error) throw error;

  const lower = trimmed.toLowerCase();
  const matched: AttendeeSearchResult[] = [];
  for (const row of (data ?? []) as unknown as Array<{ user_id: string; user: Joined<UserRow> }>) {
    const user = flatJoin(row.user);
    if (!user) continue;
    const employee = flatJoin(user.employee_profiles);
    const guest = flatJoin(user.guest_profiles);
    const first = employee?.first_name ?? guest?.first_name ?? '';
    const last = employee?.last_name ?? guest?.last_name ?? '';
    const haystack = `${first} ${last} ${user.email}`.toLowerCase();
    if (!haystack.includes(lower)) continue;
    matched.push({
      user_id: row.user_id,
      first_name: first || null,
      last_name: last || null,
      email: user.email,
      avatar_url: employee?.avatar_url ?? null,
    });
    if (matched.length >= limit) break;
  }
  return matched;
}

export function photoStorageUrls(prefix: string, originalExt: string): {
  originalPath: string;
  previewPath: string;
  thumbPath: string;
} {
  return {
    originalPath: `${prefix}/original.${originalExt}`,
    previewPath: `${prefix}/preview.webp`,
    thumbPath: `${prefix}/thumb.webp`,
  };
}
