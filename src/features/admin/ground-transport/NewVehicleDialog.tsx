import { useState } from 'react';
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
import { getSupabaseClient } from '@/lib/supabase';
import { zonedWallTimeToUtcIso } from '@/lib/timezone';

import { createVehicle, type TransportDirection } from '../api/groundTransport';

interface NewVehicleDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  /** ISO date (YYYY-MM-DD) seeded into the pickup-date field. */
  defaultDate: string;
  direction: TransportDirection;
  /** IANA tz name from the active event (e.g. "America/Edmonton"). */
  timeZone: string;
  onCreated: () => void;
}

// Pickup wall-clock anchors to the active event's timezone so MST/MDT
// shifts land in UTC correctly via zonedWallTimeToUtcIso.
const DEFAULTS = { pickupTime: '14:00', pax: 12, bags: 12 };

export function NewVehicleDialog({
  open,
  onOpenChange,
  eventId,
  defaultDate,
  direction,
  timeZone,
  onCreated,
}: NewVehicleDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [pickupDate, setPickupDate] = useState(defaultDate);
  const [pickupTime, setPickupTime] = useState(DEFAULTS.pickupTime);
  const [pax, setPax] = useState(DEFAULTS.pax);
  const [bags, setBags] = useState(DEFAULTS.bags);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setName('');
    setPickupDate(defaultDate);
    setPickupTime(DEFAULTS.pickupTime);
    setPax(DEFAULTS.pax);
    setBags(DEFAULTS.bags);
  }

  async function handleCreate(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const pickupAtIso = zonedWallTimeToUtcIso(pickupDate, pickupTime, timeZone);
      await createVehicle(getSupabaseClient(), {
        eventId,
        vehicleName: name.trim(),
        direction,
        pickupAtIso,
        pickupTz: timeZone,
        capacityPassengers: pax,
        capacityBags: bags,
      });
      onCreated();
      onOpenChange(false);
      reset();
      show(t('admin.groundTransport.vehicleCreated'));
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
