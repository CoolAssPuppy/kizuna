import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bus, Plane } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AirlineLogo } from '@/components/AirlineLogo';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';

import {
  type AssignVehicleArgs,
  type PassengerRow,
  type TransportDirection,
  assignVehicle,
  fetchPassengers,
  fetchVehicleOptions,
} from '../api/groundTransport';
import {
  bucketByPickup,
  flightCohortVehicles,
  rankVehiclesForPassenger,
  windowTimeFmt,
  type VehicleStat,
} from './grouping';
import { NewVehicleDialog } from './NewVehicleDialog';
import { VehicleSidebar } from './VehicleSidebar';

export function GroundTransportToolScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const qc = useQueryClient();
  const { show } = useToast();
  const [direction, setDirection] = useState<TransportDirection>('arrival');
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);

  const passengersQ = useQuery({
    queryKey: ['admin', 'gt', 'passengers', direction, event?.airport_iata ?? null],
    queryFn: () => fetchPassengers(getSupabaseClient(), direction, event?.airport_iata ?? null),
    enabled: !!eventId,
  });
  const vehiclesQ = useQuery({
    queryKey: ['admin', 'gt', 'vehicles', eventId, direction],
    queryFn: () => fetchVehicleOptions(getSupabaseClient(), eventId!, direction),
    enabled: !!eventId,
  });

  // Live updates: any flight, transport_request, or vehicle change kicks
  // off a refetch so the screen stays current as attendees self-edit
  // their itineraries or other admins assign in parallel.
  // useRealtimeInvalidation fingerprints its bindings internally, so a
  // fresh array literal each render is fine.
  useRealtimeInvalidation([
    { table: 'flights', invalidates: ['admin', 'gt', 'passengers', direction] },
    { table: 'transport_requests', invalidates: ['admin', 'gt', 'passengers', direction] },
    { table: 'transport_vehicles', invalidates: ['admin', 'gt', 'vehicles', eventId, direction] },
  ]);

  // Stable references for downstream useMemos: a fresh `?? []` on every
  // render would defeat their dependency arrays.
  const passengers = useMemo(() => passengersQ.data ?? [], [passengersQ.data]);
  const vehicles = useMemo(() => vehiclesQ.data ?? [], [vehiclesQ.data]);
  const eventTz = event?.time_zone ?? 'UTC';
  const eventAirport = event?.airport_iata ?? '';
  const timeFmt = useMemo(() => windowTimeFmt(eventTz), [eventTz]);
  const windows = useMemo(
    () => bucketByPickup(passengers, direction === 'arrival' ? 'origin' : 'destination', eventTz),
    [passengers, direction, eventTz],
  );

  const vehicleStats: VehicleStat[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of passengers) {
      if (row.assigned_vehicle_id) {
        counts.set(row.assigned_vehicle_id, (counts.get(row.assigned_vehicle_id) ?? 0) + 1);
      }
    }
    return vehicles.map((vehicle) => ({
      vehicle,
      assigned: counts.get(vehicle.id) ?? 0,
    }));
  }, [passengers, vehicles]);

  const assignMutation = useMutation({
    mutationFn: (args: AssignVehicleArgs) => assignVehicle(getSupabaseClient(), args),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'gt', 'passengers', direction] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return (
      <p className="py-8 text-sm text-muted-foreground">{t('admin.groundTransport.noEvent')}</p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('admin.groundTransport.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('admin.groundTransport.subtitle')}</p>
      </header>

      <DirectionTabs value={direction} onChange={setDirection} />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <PassengerLane
          passengers={passengers}
          windows={windows}
          vehicleStats={vehicleStats}
          loading={passengersQ.isLoading}
          assigning={assignMutation.isPending}
          onAssign={(args) => assignMutation.mutate(args)}
          direction={direction}
          airportCode={eventAirport}
          timeFmt={timeFmt}
        />
        <VehicleSidebar
          vehicleStats={vehicleStats}
          direction={direction}
          timeFmt={timeFmt}
          onNewVehicle={() => setNewVehicleOpen(true)}
        />
      </div>

      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        eventId={event.id}
        defaultDate={event.start_date}
        direction={direction}
        timeZone={eventTz}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ['admin', 'gt', 'vehicles', eventId, direction] });
        }}
      />
    </section>
  );
}

interface DirectionTabsProps {
  value: TransportDirection;
  onChange: (next: TransportDirection) => void;
}

function DirectionTabs({ value, onChange }: DirectionTabsProps): JSX.Element {
  const { t } = useTranslation();
  const tabs: ReadonlyArray<{ id: TransportDirection; labelKey: string }> = [
    { id: 'arrival', labelKey: 'admin.groundTransport.tabs.arrival' },
    { id: 'departure', labelKey: 'admin.groundTransport.tabs.departure' },
  ];
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-lg border p-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

interface PassengerLaneProps {
  passengers: ReadonlyArray<PassengerRow>;
  windows: ReturnType<typeof bucketByPickup>;
  vehicleStats: ReadonlyArray<VehicleStat>;
  loading: boolean;
  assigning: boolean;
  onAssign: (args: AssignVehicleArgs) => void;
  direction: TransportDirection;
  airportCode: string;
  timeFmt: Intl.DateTimeFormat;
}

function PassengerLane({
  passengers,
  windows,
  vehicleStats,
  loading,
  assigning,
  onAssign,
  direction,
  airportCode,
  timeFmt,
}: PassengerLaneProps): JSX.Element {
  const { t } = useTranslation();

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }
  if (windows.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
        {t('admin.groundTransport.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {windows.map((win) => (
        <article key={win.startIso} className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 border-b pb-1">
            <div className="flex items-center gap-2">
              <Plane aria-hidden className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold tracking-tight">{win.label}</h3>
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('admin.groundTransport.windowSummary', {
                passengers: win.totalPassengers,
                bags: win.totalBags,
              })}
            </p>
          </header>
          <ul className="space-y-3">
            {win.flights.map((group) => (
              <li key={group.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AirlineLogo
                      name={group.airline}
                      className="h-8 w-8 shrink-0 rounded-md bg-card object-contain p-1 ring-1 ring-border"
                    />
                    <p className="text-sm font-semibold">
                      {group.airline} {group.flightNumber}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {direction === 'arrival'
                          ? `${group.endpoint} → ${airportCode}`
                          : `${airportCode} → ${group.endpoint}`}{' '}
                        · {group.timeLabel}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('admin.groundTransport.flightSummary', {
                      passengers: group.passengers.length,
                      bags: group.totalBags,
                    })}
                  </span>
                </header>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.passengers.map((p) => (
                    <PassengerRowCard
                      key={p.user_id}
                      passenger={p}
                      allPassengers={passengers}
                      vehicleStats={vehicleStats}
                      assigning={assigning}
                      onAssign={onAssign}
                      direction={direction}
                      timeFmt={timeFmt}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

interface PassengerRowCardProps {
  passenger: PassengerRow;
  allPassengers: ReadonlyArray<PassengerRow>;
  vehicleStats: ReadonlyArray<VehicleStat>;
  assigning: boolean;
  onAssign: (args: AssignVehicleArgs) => void;
  direction: TransportDirection;
  timeFmt: Intl.DateTimeFormat;
}

function PassengerRowCard({
  passenger,
  allPassengers,
  vehicleStats,
  assigning,
  onAssign,
  direction,
  timeFmt,
}: PassengerRowCardProps): JSX.Element {
  const { t } = useTranslation();
  const cohort = useMemo(
    () => flightCohortVehicles(passenger, allPassengers),
    [passenger, allPassengers],
  );
  const ranked = useMemo(
    () => rankVehiclesForPassenger(passenger, vehicleStats, cohort),
    [passenger, vehicleStats, cohort],
  );

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-background p-3 transition-colors',
        passenger.needs_review && 'border-destructive/60 bg-destructive/5',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{passenger.full_name}</p>
        {passenger.needs_review ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive"
            title={t('admin.groundTransport.needsReviewHint')}
          >
            <AlertTriangle aria-hidden className="h-3 w-3" />
            {t('admin.groundTransport.needsReview')}
          </span>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Bus aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={passenger.assigned_vehicle_id ?? ''}
          onChange={(e) =>
            onAssign({
              userId: passenger.user_id,
              flightId: passenger.flight_id,
              direction,
              pickupAtIso: passenger.pickup_at,
              pickupTz: passenger.pickup_tz,
              transportRequestId: passenger.transport_request_id,
              vehicleId: e.target.value || null,
            })
          }
          disabled={assigning}
          className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
          aria-label={passenger.full_name}
        >
          <option value="">{t('admin.groundTransport.unassigned')}</option>
          {ranked.map(({ vehicle, assigned }, idx) => {
            const remaining = vehicle.capacity_passengers - assigned;
            const showFull = remaining <= 0 && passenger.assigned_vehicle_id !== vehicle.id;
            const label = t('admin.groundTransport.vehicleLabel', {
              name: vehicle.vehicle_name,
              time: timeFmt.format(new Date(vehicle.pickup_at)),
              assigned,
              capacity: vehicle.capacity_passengers,
            });
            const suggestedSuffix =
              idx === 0 && ranked.length > 1 ? ` · ${t('admin.groundTransport.suggested')}` : '';
            const fullSuffix = showFull ? ' ' + t('admin.groundTransport.full') : '';
            return (
              <option key={vehicle.id} value={vehicle.id} disabled={showFull}>
                {label}
                {suggestedSuffix}
                {fullSuffix}
              </option>
            );
          })}
        </select>
      </label>
    </li>
  );
}
