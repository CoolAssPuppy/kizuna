import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import {
  assignRoom,
  assignVehicle,
  fetchAccommodationOptions,
  fetchArrivals,
  fetchVehicleOptions,
} from './api/arrivals';

const ARRIVALS_KEY = ['admin', 'arrivals'] as const;

export function ArrivalsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const qc = useQueryClient();
  const { show } = useToast();

  const arrivalsQ = useQuery({
    queryKey: [...ARRIVALS_KEY, eventId],
    queryFn: () => fetchArrivals(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });

  const roomsQ = useQuery({
    queryKey: ['admin', 'arrivals', 'rooms', eventId],
    queryFn: () => fetchAccommodationOptions(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });

  const vehiclesQ = useQuery({
    queryKey: ['admin', 'arrivals', 'vehicles', eventId],
    queryFn: () => fetchVehicleOptions(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });

  const roomMutation = useMutation({
    mutationFn: (vars: { userId: string; accommodationId: string | null }) =>
      assignRoom(getSupabaseClient(), { ...vars, eventId: eventId! }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ARRIVALS_KEY, eventId] });
      void qc.invalidateQueries({ queryKey: ['admin', 'arrivals', 'rooms', eventId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const vehicleMutation = useMutation({
    mutationFn: (vars: {
      userId: string;
      flightId: string;
      pickupAtIso: string;
      pickupTz: string;
      transportRequestId: string | null;
      vehicleId: string | null;
    }) => assignVehicle(getSupabaseClient(), vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ARRIVALS_KEY, eventId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return (
      <p className="py-8 text-sm text-muted-foreground">{t('admin.arrivals.noEvent')}</p>
    );
  }

  const arrivals = arrivalsQ.data ?? [];
  const rooms = roomsQ.data ?? [];
  const vehicles = vehiclesQ.data ?? [];

  const arrivalFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Edmonton',
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.arrivals.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.arrivals.subtitle')}</p>
      </header>

      {arrivalsQ.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>
      ) : arrivals.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('admin.arrivals.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.passenger')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.flight')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.arrival')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.bags')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.room')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.arrivals.col.vehicle')}</th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((row) => (
                <tr key={row.flight_id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.full_name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="inline-flex items-center gap-1.5 font-medium">
                      <Plane aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                      {row.origin} → YYC
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.airline} {row.flight_number}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {arrivalFmt.format(new Date(row.arrival_at))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.bag_count}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.assigned_accommodation_id ?? ''}
                      onChange={(e) =>
                        roomMutation.mutate({
                          userId: row.user_id,
                          accommodationId: e.target.value || null,
                        })
                      }
                      disabled={roomMutation.isPending}
                      className="h-9 w-full max-w-[15rem] rounded-md border bg-background px-2 text-sm"
                      aria-label={t('admin.arrivals.col.room')}
                    >
                      <option value="">{t('admin.arrivals.unassigned')}</option>
                      {rooms.map((room) => {
                        const full = room.occupied >= room.capacity
                          && room.id !== row.assigned_accommodation_id;
                        const label = `${room.hotel_name}${room.room_number ? ' · ' + room.room_number : ''}${full ? ' (full)' : ''}`;
                        return (
                          <option key={room.id} value={room.id} disabled={full}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.assigned_vehicle_id ?? ''}
                      onChange={(e) =>
                        vehicleMutation.mutate({
                          userId: row.user_id,
                          flightId: row.flight_id,
                          pickupAtIso: row.arrival_at,
                          pickupTz: row.arrival_tz,
                          transportRequestId: row.transport_request_id,
                          vehicleId: e.target.value || null,
                        })
                      }
                      disabled={vehicleMutation.isPending}
                      className="h-9 w-full max-w-[15rem] rounded-md border bg-background px-2 text-sm"
                      aria-label={t('admin.arrivals.col.vehicle')}
                    >
                      <option value="">{t('admin.arrivals.unassigned')}</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehicle_name} ({v.capacity_passengers} pax)
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rooms.length === 0 || vehicles.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium">{t('admin.arrivals.setup.title')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {rooms.length === 0 ? (
              <li>{t('admin.arrivals.setup.noRooms')}</li>
            ) : null}
            {vehicles.length === 0 ? (
              <li>{t('admin.arrivals.setup.noVehicles')}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
