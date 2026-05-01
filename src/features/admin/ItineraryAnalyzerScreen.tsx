import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bus, Plane, Plus } from 'lucide-react';
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

import {
  type ArrivalRow,
  assignVehicle,
  fetchArrivals,
  fetchVehicleOptions,
  type VehicleOption,
} from './api/arrivals';

const WINDOW_MINUTES = 30;

interface ArrivalWindow {
  /** ISO of window start (UTC) — used as the React key. */
  startIso: string;
  /** Display label, e.g. "Mon Jan 11 · 14:00–14:30". */
  label: string;
  passengers: ArrivalRow[];
}

const WINDOW_TZ = 'America/Edmonton';
const WINDOW_START_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: WINDOW_TZ,
});
const WINDOW_END_FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: WINDOW_TZ,
});

function bucketByArrival(rows: ArrivalRow[]): ArrivalWindow[] {
  if (rows.length === 0) return [];
  const slotSizeMs = WINDOW_MINUTES * 60_000;
  const buckets = new Map<string, ArrivalRow[]>();
  for (const row of rows) {
    const slotMs = Math.floor(new Date(row.arrival_at).getTime() / slotSizeMs) * slotSizeMs;
    const key = new Date(slotMs).toISOString();
    const existing = buckets.get(key);
    if (existing) existing.push(row);
    else buckets.set(key, [row]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startIso, passengers]) => {
      const start = new Date(startIso);
      const end = new Date(start.getTime() + slotSizeMs);
      return {
        startIso,
        label: `${WINDOW_START_FMT.format(start)}–${WINDOW_END_FMT.format(end)}`,
        passengers: passengers.sort((a, b) => a.full_name.localeCompare(b.full_name)),
      };
    });
}

interface VehicleStat {
  vehicle: VehicleOption;
  assigned: number;
}

export function ItineraryAnalyzerScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const qc = useQueryClient();
  const { show } = useToast();
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);

  const arrivalsQ = useQuery({
    queryKey: ['admin', 'arrivals', eventId],
    queryFn: () => fetchArrivals(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });
  const vehiclesQ = useQuery({
    queryKey: ['admin', 'arrivals', 'vehicles', eventId],
    queryFn: () => fetchVehicleOptions(getSupabaseClient(), eventId!),
    enabled: !!eventId,
  });

  const arrivals = arrivalsQ.data;
  const vehicles = vehiclesQ.data;
  const windows = useMemo(() => bucketByArrival(arrivals ?? []), [arrivals]);

  const vehicleStats: VehicleStat[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of arrivals ?? []) {
      if (row.assigned_vehicle_id) {
        counts.set(row.assigned_vehicle_id, (counts.get(row.assigned_vehicle_id) ?? 0) + 1);
      }
    }
    return (vehicles ?? []).map((vehicle) => ({
      vehicle,
      assigned: counts.get(vehicle.id) ?? 0,
    }));
  }, [arrivals, vehicles]);

  const assignMutation = useMutation({
    mutationFn: (row: ArrivalRow & { vehicleId: string | null }) =>
      assignVehicle(getSupabaseClient(), {
        userId: row.user_id,
        flightId: row.flight_id,
        pickupAtIso: row.arrival_at,
        pickupTz: row.arrival_tz,
        transportRequestId: row.transport_request_id,
        vehicleId: row.vehicleId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'arrivals', eventId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return (
      <p className="py-8 text-sm text-muted-foreground">{t('admin.arrivals.noEvent')}</p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('admin.itineraryAnalyzer.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.itineraryAnalyzer.subtitle')}
          </p>
        </div>
        <Button onClick={() => setNewVehicleOpen(true)} className="gap-2 self-start">
          <Plus aria-hidden className="h-4 w-4" />
          {t('admin.itineraryAnalyzer.newVehicle')}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Arrival windows */}
        <div className="space-y-6">
          {arrivalsQ.isLoading && (
            <p className="text-sm text-muted-foreground">{t('admin.loading')}</p>
          )}
          {!arrivalsQ.isLoading && windows.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              {t('admin.arrivals.empty')}
            </p>
          )}
          {!arrivalsQ.isLoading
            && windows.length > 0
            && windows.map((win) => {
              const totalBags = win.passengers.reduce((s, p) => s + p.bag_count, 0);
              return (
                <article key={win.startIso} className="space-y-3">
                  <header className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Plane aria-hidden className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold tracking-tight">{win.label}</h3>
                    </div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t('admin.itineraryAnalyzer.windowSummary', {
                        passengers: win.passengers.length,
                        bags: totalBags,
                      })}
                    </p>
                  </header>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {win.passengers.map((p) => (
                      <li
                        key={p.flight_id}
                        className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-medium">{p.full_name}</p>
                          <span className="text-xs text-muted-foreground">
                            {p.origin} · {p.airline} {p.flight_number}
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <Bus aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                          <select
                            value={p.assigned_vehicle_id ?? ''}
                            onChange={(e) =>
                              assignMutation.mutate({ ...p, vehicleId: e.target.value || null })
                            }
                            disabled={assignMutation.isPending}
                            className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                            aria-label={t('admin.arrivals.col.vehicle')}
                          >
                            <option value="">{t('admin.arrivals.unassigned')}</option>
                            {vehicleStats.map(({ vehicle, assigned }) => {
                              const remaining = vehicle.capacity_passengers - assigned;
                              const showFull =
                                remaining <= 0 && p.assigned_vehicle_id !== vehicle.id;
                              return (
                                <option
                                  key={vehicle.id}
                                  value={vehicle.id}
                                  disabled={showFull}
                                >
                                  {vehicle.vehicle_name} ({assigned}/{vehicle.capacity_passengers})
                                  {showFull ? ' ' + t('admin.itineraryAnalyzer.full') : ''}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
        </div>

        {/* Vehicle sidebar */}
        <aside className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin.itineraryAnalyzer.vehiclesHeader')}
          </h3>
          {vehicleStats.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              {t('admin.itineraryAnalyzer.noVehicles')}
            </p>
          ) : (
            <ul className="space-y-2">
              {vehicleStats.map(({ vehicle, assigned }) => {
                const ratio = assigned / vehicle.capacity_passengers;
                let tone = 'bg-primary';
                if (ratio >= 1) tone = 'bg-destructive';
                else if (ratio >= 0.8) tone = 'bg-amber-500';
                return (
                  <li
                    key={vehicle.id}
                    className="space-y-2 rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{vehicle.vehicle_name}</p>
                      <span className="text-xs text-muted-foreground">
                        {assigned}/{vehicle.capacity_passengers}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${tone}`}
                        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowRight aria-hidden className="h-3 w-3" />
            {t('admin.itineraryAnalyzer.dragHint')}
          </p>
        </aside>
      </div>

      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        eventId={event.id}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ['admin', 'arrivals', 'vehicles', eventId] });
        }}
      />
    </section>
  );
}

interface NewVehicleDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  onCreated: () => void;
}

function NewVehicleDialog({
  open,
  onOpenChange,
  eventId,
  onCreated,
}: NewVehicleDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [pax, setPax] = useState(12);
  const [bags, setBags] = useState(12);
  const [busy, setBusy] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { error } = await getSupabaseClient().from('transport_vehicles').insert({
        event_id: eventId,
        vehicle_name: name.trim(),
        capacity_passengers: pax,
        capacity_bags: bags,
      });
      if (error) throw error;
      onCreated();
      onOpenChange(false);
      setName('');
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
          <DialogTitle>{t('admin.itineraryAnalyzer.newVehicleTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle-name">
              {t('admin.itineraryAnalyzer.vehicleName')}
            </Label>
            <Input
              id="vehicle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Banff Airporter coach 12"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-pax">{t('admin.itineraryAnalyzer.capacityPax')}</Label>
              <Input
                id="vehicle-pax"
                type="number"
                min={1}
                value={pax}
                onChange={(e) => setPax(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-bags">{t('admin.itineraryAnalyzer.capacityBags')}</Label>
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
            {t('admin.itineraryAnalyzer.createVehicle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
