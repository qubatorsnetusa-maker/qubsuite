import type { CellValidation } from '@qub/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/form-controls';
import { parseListItems } from './validation';

/** Data → Data validation: a dropdown list of items or a checkbox, for the selected range. */
export function ValidationDialog({
  open,
  rangeLabel,
  current,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  rangeLabel: string;
  current: CellValidation | null;
  onSave(validation: CellValidation | null): void;
  onOpenChange(open: boolean): void;
}) {
  const [kind, setKind] = useState<'list' | 'checkbox'>('list');
  const [items, setItems] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(current?.kind ?? 'list');
    setItems(current?.kind === 'list' ? current.values.join('\n') : '');
    setError(null);
  }, [open, current]);

  const save = () => {
    if (kind === 'checkbox') return onSave({ kind: 'checkbox' });
    const parsed = parseListItems(items);
    if ('error' in parsed) return setError(parsed.error);
    onSave({ kind: 'list', values: parsed.values });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Data validation" description={`Applies to ${rangeLabel}`}>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">Criteria</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="validation-kind" checked={kind === 'list'} onChange={() => setKind('list')} /> Dropdown (list of items)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="validation-kind" checked={kind === 'checkbox'} onChange={() => setKind('checkbox')} aria-label="Checkbox" /> Checkbox
          </label>
        </fieldset>
        {kind === 'list' && (
          <div className="mt-3">
            <Textarea
              aria-label="List items"
              value={items}
              onChange={(e) => {
                setItems(e.target.value);
                setError(null);
              }}
              placeholder="One item per line"
              rows={6}
              invalid={!!error}
            />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        )}
        {kind === 'checkbox' && <p className="mt-3 text-xs text-muted">Empty cells become unchecked checkboxes (FALSE).</p>}
        <DialogFooter className="mt-4">
          {current && (
            <Button variant="subtle" onClick={() => onSave(null)}>
              Remove validation
            </Button>
          )}
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
