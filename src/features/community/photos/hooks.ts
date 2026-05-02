import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';

import {
  loadPhotoById,
  loadProfileActivity,
  loadRecentPhotos,
  searchAttendees,
  searchPhotos,
  softDeletePhoto,
  uploadPhoto,
  type AttendeeSearchResult,
  type PhotoRecord,
  type UploadPhotoArgs,
} from './api';
import { classifyQuery } from './searchQuery';

export function useRecentPhotos(eventId: string | null, limit = 20) {
  return useQuery<PhotoRecord[]>({
    queryKey: ['community', 'photos', 'recent', eventId, limit],
    queryFn: () => loadRecentPhotos(getSupabaseClient(), eventId!, limit),
    enabled: !!eventId,
  });
}

export function usePhotoSearch(eventId: string | null, queryString: string) {
  const classified = classifyQuery(queryString);
  return useQuery<PhotoRecord[]>({
    queryKey: [
      'community',
      'photos',
      'search',
      eventId,
      classified.kind,
      classified.kind === 'empty' ? '' : classified.value,
    ],
    queryFn: () =>
      searchPhotos(getSupabaseClient(), { eventId: eventId!, query: classified, limit: 60 }),
    enabled: !!eventId,
  });
}

export function usePhotoById(photoId: string | null) {
  return useQuery<PhotoRecord | null>({
    queryKey: ['community', 'photos', 'byId', photoId],
    queryFn: () => loadPhotoById(getSupabaseClient(), photoId!),
    enabled: !!photoId,
  });
}

export function useProfileActivityPhotos(
  userId: string | null,
  eventId: string | null,
  limit = 10,
) {
  return useQuery<PhotoRecord[]>({
    queryKey: ['community', 'photos', 'profile', userId, eventId, limit],
    queryFn: () => loadProfileActivity(getSupabaseClient(), userId!, eventId!, limit),
    enabled: !!userId && !!eventId,
  });
}

export function useAttendeeSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<AttendeeSearchResult[]>({
    queryKey: ['community', 'attendees', 'search', trimmed.toLowerCase()],
    queryFn: () => searchAttendees(getSupabaseClient(), trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: UploadPhotoArgs) => uploadPhoto(getSupabaseClient(), args),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community', 'photos'] });
    },
  });
}

export function useSoftDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => softDeletePhoto(getSupabaseClient(), photoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community', 'photos'] });
    },
  });
}
