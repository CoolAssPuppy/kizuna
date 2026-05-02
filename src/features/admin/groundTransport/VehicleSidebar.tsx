import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { TransportDirection, VehicleOption } from '../api/groundTransport';

import type { VehicleStat } from './grouping';

interface VehicleSidebarProps {
  vehicleStats: ReadonlyArray<VehicleStat>;
  direction: TransportDirection;
  timeFmt: Intl.DateTimeFormat;
}

/**
 * Right-rail summary of every vehicle in the active leg with a
 * capacity bar. Stays in sync with the assignment grid via the same
 * `vehicleStats` array the grid renders from — no second fetch.
 */
export function VehicleSidebar({
  vehicleStats,
  direction,
  timeFmt,
}: VehicleSidebarProps): JSX.Element {
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
            <VehicleSidebarRow
              key={vehicle.id}
              vehicle={vehicle}
              assigned={assigned}
              timeFmt={timeFmt}
            />
          ))}
        </ul>
      )}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
        {t(`admin.groundTransport.tabs.${direction}`)}
      </p>
    </aside>
  );
}

interface VehicleSidebarRowProps {
  vehicle: VehicleOption;
  assigned: number;
  timeFmt: Intl.DateTimeFormat;
}

function VehicleSidebarRow({ vehicle, assigned, timeFmt }: VehicleSidebarRowProps): JSX.Element {
  const ratio = assigned / vehicle.capacity_passengers;
  const tone = capacityTone(ratio);
  return (
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{vehicle.vehicle_name}</p>
        <span className="text-xs text-muted-foreground">
          {assigned}/{vehicle.capacity_passengers}
        </span>
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
        {timeFmt.format(new Date(vehicle.pickup_at))}
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

/**
 * Capacity bar colour: red when full, amber once 80% loaded, primary otherwise.
 */
function capacityTone(ratio: number): string {
  if (ratio >= 1) return 'bg-destructive';
  if (ratio >= 0.8) return 'bg-amber-500';
  return 'bg-primary';
}
