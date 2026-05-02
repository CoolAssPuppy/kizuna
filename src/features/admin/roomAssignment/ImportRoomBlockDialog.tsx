import { ClipboardPaste, FileUp, FlaskConical } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { importRoomBlock } from '../api/rooms';
import { buildTestRoomBlockCsv } from './testRoomBlock';
import { parseRoomCsv, type ParsedRoom } from './csv';

interface ImportRoomBlockDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  defaultHotel: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
  onImported: () => void;
}

type ImportTab = 'paste' | 'upload';

export function ImportRoomBlockDialog({
  open,
  onOpenChange,
  eventId,
  defaultHotel,
  defaultCheckIn,
  defaultCheckOut,
  onImported,
}: ImportRoomBlockDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [hotelName, setHotelName] = useState(defaultHotel);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [tab, setTab] = useState<ImportTab>('paste');
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<{ line: number; message: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset(): void {
    setHotelName(defaultHotel);
    setCheckIn(defaultCheckIn);
    setCheckOut(defaultCheckOut);
    setTab('paste');
    setCsvText('');
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileUpload(file: File): Promise<void> {
    const text = await file.text();
    setCsvText(text);
    setTab('paste');
    setErrors([]);
  }

  async function handleImport(): Promise<void> {
    if (!hotelName.trim() || !csvText.trim()) return;
    setBusy(true);
    setErrors([]);
    const parsed = parseRoomCsv(csvText);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      setErrors(parsed.errors);
      setBusy(false);
      return;
    }
    try {
      const rooms: ParsedRoom[] = parsed.rows;
      const result = await importRoomBlock(getSupabaseClient(), {
        eventId,
        hotelName: hotelName.trim(),
        checkIn,
        checkOut,
        rooms,
      });
      show(
        t('admin.roomAssignment.imported', {
          inserted: result.inserted,
          warnings: parsed.errors.length,
        }),
      );
      onImported();
      onOpenChange(false);
      reset();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('admin.roomAssignment.importTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="hotel-name">{t('admin.roomAssignment.hotelName')}</Label>
              <Input
                id="hotel-name"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-in">{t('admin.roomAssignment.checkIn')}</Label>
              <Input
                id="check-in"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-out">{t('admin.roomAssignment.checkOut')}</Label>
              <Input
                id="check-out"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div role="tablist" className="inline-flex gap-1 rounded-lg border p-1">
            {(['paste', 'upload'] as const).map((id) => {
              const active = tab === id;
              const Icon = id === 'paste' ? ClipboardPaste : FileUp;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {t(`admin.roomAssignment.tab.${id}`)}
                </button>
              );
            })}
          </div>

          {tab === 'paste' ? (
            <div className="space-y-2">
              <Label htmlFor="csv-text">{t('admin.roomAssignment.csv')}</Label>
              <Textarea
                id="csv-text"
                rows={10}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="room_number,description,size_sqm,is_suite&#10;101,Mountain-view king,32,false&#10;201,Two-bedroom suite,68,true"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">{t('admin.roomAssignment.csvHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="csv-file">{t('admin.roomAssignment.fileLabel')}</Label>
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground hover:file:bg-accent"
              />
              <p className="text-xs text-muted-foreground">{t('admin.roomAssignment.fileHint')}</p>
              {csvText ? (
                <p className="text-xs text-muted-foreground">
                  {t('admin.roomAssignment.fileLoaded', {
                    bytes: csvText.length,
                    rows: csvText.split('\n').filter((l) => l.trim()).length - 1,
                  })}
                </p>
              ) : null}
            </div>
          )}

          {errors.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {errors.map((err, idx) => (
                <li key={idx}>
                  {t('admin.roomAssignment.errorLine', { line: err.line })}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter className="sm:justify-between">
          {/* "TEST ROOM BLOCK" filler. Temporarily un-gated for prod
              demos — re-add `import.meta.env.DEV` before launch. */}
          <Button
            type="button"
            variant="outline"
            className="-rotate-1 border-2 border-dashed border-purple-500 font-bold uppercase tracking-wide text-purple-700 hover:text-purple-900"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(168,85,247,0.18) 0 8px, transparent 8px 16px)',
            }}
            onClick={() => {
              setCsvText(buildTestRoomBlockCsv());
              setTab('paste');
              setErrors([]);
            }}
          >
            <FlaskConical aria-hidden className="mr-2 h-4 w-4" />
            {t('admin.roomAssignment.testBlock')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={busy || hotelName.trim().length < 2 || csvText.trim().length === 0}
            >
              {busy ? t('admin.roomAssignment.importing') : t('admin.roomAssignment.import')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
