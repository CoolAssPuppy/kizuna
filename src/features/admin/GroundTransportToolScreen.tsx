import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bus, Plane, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';

import {
  type AssignVehicleArgs,
  type PassengerRow,
  type TransportDirection,
  type VehicleOption,
  assignVehicle,
  createVehicle,
  fetchPassengers,
  fetchVehicleOptions,
} from './api/groundTransport';
import {
  bucketByPickup,
  flightCohortVehicles,
  rankVehiclesForPassenger,
  WINDOW_TZ,
  type VehicleStat,
} from './groundTransport/grouping';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: WINDOW_TZ,
});

export function GroundTransportToolScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const qc = useQueryClient();
  const { show } = useToast();
  const [direction, setDirection] = useState<TransportDirection>('arrival');
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);

  const passengersQ = useQuery({
    queryKey: ['admin', 'gt', 'passengers', direction],
    queryFn: () => fetchPassengers(getSupabaseClient(), direction),
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
  useRealtimeInvalidation(
    useMemo(
      () => [
        { table: 'flights', invalidates: ['admin', 'gt', 'passengers', direction] },
        { table: 'transport_requests', invalidates: ['admin', 'gt', 'passengers', direction] },
        {
          table: 'transport_vehicles',
          invalidates: ['admin', 'gt', 'vehicles', eventId, direction],
        },
      ],
      [direction, eventId],
    ),
  );

  const passengers = useMemo(() => passengersQ.data ?? [], [passengersQ.data]);
  const vehicles = useMemo(() => vehiclesQ.data ?? [], [vehiclesQ.data]);
  const windows = useMemo(
    () => bucketByPickup(passengers, direction === 'arrival' ? 'origin' : 'destination'),
    [passengers, direction],
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('admin.groundTransport.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('admin.groundTransport.subtitle')}</p>
        </div>
        <Button onClick={() => setNewVehicleOpen(true)} className="gap-2 self-start">
          <Plus aria-hidden className="h-4 w-4" />
          {t('admin.groundTransport.newVehicle')}
        </Button>
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
        />
        <VehicleSidebar vehicleStats={vehicleStats} direction={direction} />
      </div>

      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        eventId={event.id}
        direction={direction}
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
}

function PassengerLane({
  passengers,
  windows,
  vehicleStats,
  loading,
  assigning,
  onAssign,
  direction,
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
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {group.airline} {group.flightNumber}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {direction === 'arrival' ? 'from' : 'to'} {group.endpoint} · {group.timeLabel}
                    </span>
                  </p>
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
}

function PassengerRowCard({
  passenger,
  allPassengers,
  vehicleStats,
  assigning,
  onAssign,
  direction,
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
          aria-label={t('admin.groundTransport.title')}
        >
          <option value="">{t('admin.groundTransport.unassigned')}</option>
          {ranked.map(({ vehicle, assigned }, idx) => {
            const remaining = vehicle.capacity_passengers - assigned;
            const showFull = remaining <= 0 && passenger.assigned_vehicle_id !== vehicle.id;
            const label = t('admin.groundTransport.vehicleLabel', {
              name: vehicle.vehicle_name,
              time: TIME_FMT.format(new Date(vehicle.pickup_at)),
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

interface VehicleSidebarProps {
  vehicleStats: ReadonlyArray<VehicleStat>;
  direction: TransportDirection;
}

function VehicleSidebar({ vehicleStats, direction }: VehicleSidebarProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <aside className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles aria-hidden className="h-3 w-3" />
        {t('admin.groundTransport.vehiclesHeader')}
      </h3>
      {vehicleStats.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          {t('admin.groundTransport.noVehiclesForLeg')}
        </p>
      ) : (
        <ul className="space-y-2">
          {vehicleStats.map(({ vehicle, assigned }) => (
            <VehicleSidebarRow key={vehicle.id} vehicle={vehicle} assigned={assigned} />
          ))}
        </ul>
      )}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
        {t(`admin.groundTransport.tabs.${direction}`)}
      </p>
    </aside>
  );
}

function VehicleSidebarRow({
  vehicle,
  assigned,
}: {
  vehicle: VehicleOption;
  assigned: number;
}): JSX.Element {
  const ratio = assigned / vehicle.capacity_passengers;
  let tone = 'bg-primary';
  if (ratio >= 1) tone = 'bg-destructive';
  else if (ratio >= 0.8) tone = 'bg-amber-500';
  return (
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{vehicle.vehicle_name}</p>
        <span className="text-xs text-muted-foreground">
          {assigned}/{vehicle.capacity_passengers}
        </span>
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
        {TIME_FMT.format(new Date(vehicle.pickup_at))}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full', tone)}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </div>
    </li>
  );
}

interface NewVehicleDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  direction: TransportDirection;
  onCreated: () => void;
}

function NewVehicleDialog({
  open,
  onOpenChange,
  eventId,
  direction,
  onCreated,
}: NewVehicleDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [pickupDate, setPickupDate] = useState('2027-01-11');
  const [pickupTime, setPickupTime] = useState('14:00');
  const [pax, setPax] = useState(12);
  const [bags, setBags] = useState(12);
  const [busy, setBusy] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      // Build a UTC ISO from the local-Mountain date+time picker. The Date
      // constructor parses 'YYYY-MM-DDTHH:mm' as LOCAL time, which would
      // pick up whichever timezone the admin's machine is in — wrong for
      // a Mountain-time event. So we compose the UTC instant manually.
      const pickupAtIso = mountainToUtcIso(pickupDate, pickupTime);
      await createVehicle(getSupabaseClient(), {
        eventId,
        vehicleName: name.trim(),
        direction,
        pickupAtIso,
        pickupTz: WINDOW_TZ,
        capacityPassengers: pax,
        capacityBags: bags,
      });
      onCreated();
      onOpenChange(false);
      setName('');
      setPickupDate('2027-01-11');
      setPickupTime('14:00');
      setPax(12);
      setBags(12);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.groundTransport.newVehicleTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle-name">{t('admin.groundTransport.vehicleName')}</Label>
            <Input
              id="vehicle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.groundTransport.vehicleNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-date">{t('admin.groundTransport.vehiclePickupDate')}</Label>
              <Input
                id="vehicle-date"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-time">{t('admin.groundTransport.vehiclePickupTime')}</Label>
              <Input
                id="vehicle-time"
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-pax">{t('admin.groundTransport.capacityPax')}</Label>
              <Input
                id="vehicle-pax"
                type="number"
                min={1}
                value={pax}
                onChange={(e) => setPax(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-bags">{t('admin.groundTransport.capacityBags')}</Label>
              <Input
                id="vehicle-bags"
                type="number"
                min={0}
                value={bags}
                onChange={(e) => setBags(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={busy || name.trim().length < 2}>
            {t('admin.groundTransport.createVehicle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Combine a YYYY-MM-DD date and HH:mm time, interpreted as Mountain Time
 * at the event venue (no DST in Jan, MST = UTC-7), into a UTC ISO string.
 * Browsers do not give us a built-in "construct a Date in tz X" so we
 * compute the offset numerically.
 */
function mountainToUtcIso(date: string, time: string): string {
  // MST is UTC-7. A 14:00 MST pickup is 21:00 UTC.
  const [hours = '0', minutes = '0'] = time.split(':');
  const utcHours = (Number(hours) + 7) % 24;
  const dayOverflow = Number(hours) + 7 >= 24 ? 1 : 0;
  const baseDate = new Date(`${date}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + dayOverflow);
  baseDate.setUTCHours(utcHours, Number(minutes), 0, 0);
  return baseDate.toISOString();
}
