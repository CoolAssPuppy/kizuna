import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { SessionTag } from './tagsApi';

interface Props {
  tags: ReadonlyArray<SessionTag>;
  selectedIds: ReadonlyArray<string>;
  onChange: (next: string[]) => void;
  inputId?: string;
}

/**
 * Multi-select tag picker rendered as a row of toggleable pills. Stays
 * compact in dialogs and uses the tag color as the visual anchor.
 */
export function TagPicker({ tags, selectedIds, onChange, inputId }: Props): JSX.Element {
  const { t } = useTranslation();
  const selected = new Set(selectedIds);

  function toggle(id: string): void {
    if (selected.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{t('agenda.tags.fieldLabel')}</Label>
      <div
        id={inputId}
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={t('agenda.tags.fieldLabel')}
      >
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('agenda.tags.empty')}</p>
        ) : (
          tags.map((tag) => {
            const active = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight transition-opacity',
                  active ? 'opacity-100' : 'opacity-40 hover:opacity-70',
                )}
                style={
                  active
                    ? { backgroundColor: tag.color, color: '#ffffff' }
                    : {
                        backgroundColor: 'transparent',
                        color: tag.color,
                        boxShadow: `inset 0 0 0 1px ${tag.color}`,
                      }
                }
              >
                {tag.name}
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('agenda.tags.fieldHint')}</p>
    </div>
  );
}
