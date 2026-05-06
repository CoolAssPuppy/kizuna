import { Mail, Upload, type LucideIcon, ClipboardPaste } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { type BulkAddResult, type InvitationDraft, addInvitations } from './api';
import { parseInvitationsCsv } from './csv';

type Tab = 'one' | 'paste' | 'csv';

const TAB_ICON: Record<Tab, LucideIcon> = {
  one: Mail,
  paste: ClipboardPaste,
  csv: Upload,
};

const TABS: ReadonlyArray<Tab> = ['one', 'paste', 'csv'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  existingEmails: ReadonlyArray<string>;
  /** Called once after a successful add so the parent can invalidate. */
  onAdded: (result: BulkAddResult) => void;
}

/**
 * Three-tab dialog for inviting attendees. Mirrors the shape of
 * ImportItineraryDialog. Bulk paste tolerates one-email-per-line plus
 * comma/space separators; CSV requires the spec'd header row.
 */
export function InviteAttendeeDialog({
  open,
  onOpenChange,
  eventId,
  existingEmails,
  onAdded,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('one');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // One-email tab state
  const [singleEmail, setSingleEmail] = useState('');
  const [singleFirst, setSingleFirst] = useState('');
  const [singleLast, setSingleLast] = useState('');

  // Paste tab state
  const [pasted, setPasted] = useState('');

  // CSV tab state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvSummary, setCsvSummary] = useState<string | null>(null);

  function reset(): void {
    setSingleEmail('');
    setSingleFirst('');
    setSingleLast('');
    setPasted('');
    setCsvSummary(null);
    setErrorMessage(null);
  }

  async function commit(drafts: ReadonlyArray<InvitationDraft>): Promise<void> {
    if (!user) {
      setErrorMessage(t('admin.invitations.add.errors.unauthenticated'));
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await addInvitations(getSupabaseClient(), {
        eventId,
        drafts,
        existingEmails,
        invitedBy: user.id,
      });
      const summary = t('admin.invitations.add.summary', {
        added: result.inserted,
        skipped: result.skipped_duplicates,
        rejected: result.rejected_invalid,
      });
      show(summary);
      onAdded(result);
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`${t('admin.invitations.add.errors.failed')} — ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitOne(): Promise<void> {
    await commit([{ email: singleEmail, first_name: singleFirst, last_name: singleLast }]);
  }

  async function handleSubmitPaste(): Promise<void> {
    const parsed = parsePasteBlob(pasted);
    if (parsed.length === 0) {
      setErrorMessage(t('admin.invitations.add.errors.pasteEmpty'));
      return;
    }
    await commit(parsed);
  }

  function handleCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parse = parseInvitationsCsv(text);
      if (parse.errors.length > 0 && parse.drafts.length === 0) {
        const message = parse.errors[0]?.message ?? 'csv_invalid';
        setErrorMessage(t('admin.invitations.add.errors.csv', { message }));
        return;
      }
      setCsvSummary(
        t('admin.invitations.add.csv.preview', {
          ready: parse.drafts.length,
          rejected: parse.rejectedInvalid,
        }),
      );
      void commit(parse.drafts);
    };
    reader.readAsText(file);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{t('admin.invitations.add.title')}</DialogTitle>
          <DialogDescription>{t('admin.invitations.add.subtitle')}</DialogDescription>
        </DialogHeader>

        <div role="tablist" className="flex border-b bg-muted/30 px-6">
          {TABS.map((id) => {
            const Icon = TAB_ICON[id];
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors',
                  active && 'border-primary text-foreground',
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {t(`admin.invitations.add.tabs.${id}`)}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-5">
          {tab === 'one' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{t('admin.invitations.add.one.email')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="taylor@supabase.io"
                  autoComplete="email"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-first">{t('admin.invitations.add.one.firstName')}</Label>
                  <Input
                    id="invite-first"
                    value={singleFirst}
                    onChange={(e) => setSingleFirst(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-last">{t('admin.invitations.add.one.lastName')}</Label>
                  <Input
                    id="invite-last"
                    value={singleLast}
                    onChange={(e) => setSingleLast(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : tab === 'paste' ? (
            <div className="space-y-3">
              <Label htmlFor="invite-paste">{t('admin.invitations.add.paste.label')}</Label>
              <Textarea
                id="invite-paste"
                rows={8}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={t('admin.invitations.add.paste.placeholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.invitations.add.paste.hint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('admin.invitations.add.csv.hint')}</p>
              <pre className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                email,first_name,last_name{'\n'}
                taylor@supabase.io,Taylor,Reed{'\n'}
                avery@supabase.io,Avery,Lin
              </pre>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {t('admin.invitations.add.csv.choose')}
              </Button>
              {csvSummary ? <p className="text-xs text-muted-foreground">{csvSummary}</p> : null}
            </div>
          )}

          {errorMessage ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          {tab === 'one' ? (
            <Button onClick={() => void handleSubmitOne()} disabled={busy}>
              {busy ? t('admin.invitations.add.adding') : t('admin.invitations.add.submit')}
            </Button>
          ) : tab === 'paste' ? (
            <Button onClick={() => void handleSubmitPaste()} disabled={busy || !pasted.trim()}>
              {busy ? t('admin.invitations.add.adding') : t('admin.invitations.add.submit')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tolerates a paste blob in either of:
 *
 *   - One row per line: `email,first_name,last_name`
 *   - Tab-separated: `email\tfirst_name\tlast_name`
 *
 * Lines without the three required fields are skipped and counted as
 * invalid downstream by addInvitations.
 */
function parsePasteBlob(blob: string): InvitationDraft[] {
  const out: InvitationDraft[] = [];
  for (const rawLine of blob.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/[,\t]\s*/).map((p) => p.trim());
    const [email, first, last] = parts;
    if (!email || !first || !last) continue;
    out.push({ email, first_name: first, last_name: last });
  }
  return out;
}
