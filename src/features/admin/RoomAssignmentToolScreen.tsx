import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Hotel, Plus, Sparkles, Upload, UserMinus, Users, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';

import {
  assignOccupant,
  assignOccupantsBulk,
  fetchAssignableAttendees,
  fetchRooms,
  removeOccupant,
  type AssignableUser,
  type RoomWithOccupants,
} from './api/rooms';
import { autoAssignRooms } from './roomAssignment/autoAssign';
import { ImportRoomBlockDialog } from './roomAssignment/ImportRoomBlockDialog';

/**
 * Room Assignment Tool. CSV-driven import of a hotel block, then
 * manual occupant assignment per room. The auto-assign rules engine
 * (Leadership -> Suites, has-dependents -> Suites + Family, largest
 * rooms -> earliest registrations) is the next-up follow-up; the
 * column we read for that — registrations.created_at, users.is_leadership,
 * additional_guests.sponsor_id — are already exposed via
 * fetchAssignableAttendees.
 */
export function RoomAssignmentToolScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const qc = useQueryClient();
  const { show } = useToast();
  const [importOpen, setImportOpen] = useState(false);

  useRealtimeInvalidation(
    useMemo(
      () => [
        { table: 'accommodations', invalidates: ['admin', 'rooms', eventId] },
        { table: 'accommodation_occupants', invalidates: ['admin', 'rooms', eventId] },
      ],
      [eventId],
    ),
  );

  const roomsQuery = useQuery({
    queryKey: ['admin', 'rooms', eventId],
    queryFn: () => fetchRooms(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });
  const attendeesQuery = useQuery({
    queryKey: ['admin', 'rooms', 'attendees', eventId],
    queryFn: () => fetchAssignableAttendees(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });

  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const attendees = useMemo(() => attendeesQuery.data ?? [], [attendeesQuery.data]);
  const assignedUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const room of rooms) for (const occ of room.occupants) set.add(occ.user_id);
    return set;
  }, [rooms]);
  const unassignedAttendees = useMemo(
    () => attendees.filter((a) => !assignedUserIds.has(a.user_id)),
    [attendees, assignedUserIds],
  );

  const assignMutation = useMutation({
    mutationFn: (args: { accommodationId: string; userId: string; isPrimary: boolean }) =>
      assignOccupant(getSupabaseClient(), args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rooms', eventId] }),
    onError: (err: Error) => show(err.message, 'error'),
  });
  const removeMutation = useMutation({
    mutationFn: (args: { accommodationId: string; userId: string }) =>
      removeOccupant(getSupabaseClient(), args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'rooms', eventId] }),
    onError: (err: Error) => show(err.message, 'error'),
  });

  // Auto-assign: run the pure rules engine against the current rooms +
  // unassigned attendees, then fan out the resulting (room, user) pairs
  // through the same single-row assignOccupant API. We invalidate once
  // at the end rather than per-row to avoid the realtime channel
  // hammering the cache.
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const result = autoAssignRooms(
        rooms.map((r) => ({
          id: r.id,
          capacity: r.capacity,
          is_suite: r.is_suite,
          room_type: r.room_type,
          size_sqm: r.size_sqm,
          occupied: r.occupants.length,
        })),
        unassignedAttendees,
      );
      // Single round trip rather than 60 sequential inserts. Same RLS,
      // same constraint check (accommodation_occupants.unique
      // (accommodation_id, user_id) catches double-assignment).
      await assignOccupantsBulk(getSupabaseClient(), result.assignments);
      return result;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'rooms', eventId] });
      show(
        t('admin.roomAssignment.autoAssignDone', {
          assigned: result.assignments.length,
          unplaced: result.unplaced.length,
        }),
      );
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return (
      <p className="py-8 text-sm text-muted-foreground">{t('admin.roomAssignment.noEvent')}</p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.roomAssignment.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.roomAssignment.subtitle')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <RoomList
          rooms={rooms}
          attendees={attendees}
          assignedUserIds={assignedUserIds}
          loading={roomsQuery.isLoading}
          assigning={assignMutation.isPending || removeMutation.isPending}
          onAssign={(args) => assignMutation.mutate(args)}
          onRemove={(args) => removeMutation.mutate(args)}
        />
        <div className="space-y-3">
          <Sidebar rooms={rooms} unassigned={unassignedAttendees} />
          <Button onClick={() => setImportOpen(true)} className="w-full gap-2">
            <Upload aria-hidden className="h-4 w-4" />
            {t('admin.roomAssignment.importBlock')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={
              autoAssignMutation.isPending || rooms.length === 0 || unassignedAttendees.length === 0
            }
            onClick={() => autoAssignMutation.mutate()}
          >
            <Wand2 aria-hidden className="h-4 w-4" />
            {autoAssignMutation.isPending
              ? t('admin.roomAssignment.autoAssigning')
              : t('admin.roomAssignment.autoAssign')}
          </Button>
        </div>
      </div>

      <ImportRoomBlockDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={event.id}
        defaultHotel={event.location ?? ''}
        defaultCheckIn={event.start_date}
        defaultCheckOut={event.end_date}
        onImported={() => {
          void qc.invalidateQueries({ queryKey: ['admin', 'rooms', eventId] });
        }}
      />
    </section>
  );
}

interface RoomListProps {
  rooms: ReadonlyArray<RoomWithOccupants>;
  attendees: ReadonlyArray<AssignableUser>;
  assignedUserIds: Set<string>;
  loading: boolean;
  assigning: boolean;
  onAssign: (args: { accommodationId: string; userId: string; isPrimary: boolean }) => void;
  onRemove: (args: { accommodationId: string; userId: string }) => void;
}

function RoomList({
  rooms,
  attendees,
  assignedUserIds,
  loading,
  assigning,
  onAssign,
  onRemove,
}: RoomListProps): JSX.Element {
  const { t } = useTranslation();
  if (loading) return <p className="text-sm text-muted-foreground">{t('admin.loading')}</p>;
  if (rooms.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
        {t('admin.roomAssignment.empty')}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rooms.map((room) => {
        const remaining = room.capacity - room.occupants.length;
        const tone = remaining <= 0 ? 'border-destructive/40 bg-destructive/5' : '';
        return (
          <li
            key={room.id}
            className={cn(
              'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between',
              tone,
            )}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-base font-semibold">
                  {room.hotel_name} · {room.room_number}
                  {room.is_suite ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      <Crown aria-hidden className="h-3 w-3" />
                      {t('admin.roomAssignment.suiteTag')}
                    </span>
                  ) : null}
                </p>
                <span className="text-xs text-muted-foreground">
                  {t('admin.roomAssignment.capacityLabel', {
                    occupied: room.occupants.length,
                    capacity: room.capacity,
                  })}
                </span>
              </div>
              {room.description ? (
                <p className="text-sm text-muted-foreground">{room.description}</p>
              ) : null}
              {room.size_sqm ? (
                <p className="text-xs text-muted-foreground">
                  {t('admin.roomAssignment.sizeLabel', { sqm: room.size_sqm })}
                </p>
              ) : null}
              {room.occupants.length > 0 ? (
                <ul className="space-y-1">
                  {room.occupants.map((occ) => (
                    <li
                      key={occ.user_id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      <span>
                        {occ.full_name}
                        <span className="ml-1 text-muted-foreground">· {occ.email}</span>
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label={t('admin.roomAssignment.removeOccupant')}
                        onClick={() => onRemove({ accommodationId: room.id, userId: occ.user_id })}
                      >
                        <UserMinus aria-hidden className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {remaining > 0 ? (
              <select
                disabled={assigning}
                value=""
                onChange={(e) => {
                  const userId = e.target.value;
                  if (!userId) return;
                  onAssign({
                    accommodationId: room.id,
                    userId,
                    isPrimary: room.occupants.length === 0,
                  });
                  e.target.value = '';
                }}
                className="h-9 rounded-md border bg-background px-2 text-xs"
                aria-label={t('admin.roomAssignment.addOccupant')}
              >
                <option value="">{t('admin.roomAssignment.assignPlaceholder')}</option>
                {attendees
                  .filter((a) => !assignedUserIds.has(a.user_id))
                  .map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.full_name} {a.is_leadership ? '★' : ''}
                      {a.has_dependents ? ' 👶' : ''}
                    </option>
                  ))}
              </select>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface SidebarProps {
  rooms: ReadonlyArray<RoomWithOccupants>;
  unassigned: ReadonlyArray<AssignableUser>;
}

function Sidebar({ rooms, unassigned }: SidebarProps): JSX.Element {
  const { t } = useTranslation();
  const totalRooms = rooms.length;
  const suiteCount = rooms.filter((r) => r.is_suite).length;
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const assigned = rooms.reduce((s, r) => s + r.occupants.length, 0);
  return (
    <aside className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles aria-hidden className="h-3 w-3" />
        {t('admin.roomAssignment.summaryHeader')}
      </h3>
      <ul className="space-y-2">
        <SummaryRow icon={Hotel} label={t('admin.roomAssignment.totalRooms')} value={totalRooms} />
        <SummaryRow icon={Crown} label={t('admin.roomAssignment.suites')} value={suiteCount} />
        <SummaryRow
          icon={Users}
          label={t('admin.roomAssignment.assignedOf', { assigned, capacity: totalCapacity })}
          value={`${assigned}/${totalCapacity}`}
        />
        <SummaryRow
          icon={Plus}
          label={t('admin.roomAssignment.unassigned')}
          value={unassigned.length}
        />
      </ul>
    </aside>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hotel;
  label: string;
  value: number | string;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden className="h-4 w-4" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
