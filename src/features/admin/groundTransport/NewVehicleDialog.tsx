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

/**
 * Admin-only dialog to add a vehicle to a leg. The pickup wall-clock
 * is anchored to the active event's timezone so MST/MDT or zone shifts
 * land in UTC correctly. Stripe-style: defaults that survive the user's
 * "I just want to add a 12-pax bus quickly" workflow.
 */
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
  const [pickupTime, setPickupTime] = useState('14:00');
  const [pax, setPax] = useState(12);
  const [bags, setBags] = useState(12);
  const [busy, setBusy] = useState(false);

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
      setName('');
      setPickupDate(defaultDate);
      setPickupTime('14:00');
      setPax(12);
      setBags(12);
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
