import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api';
import { sheetsService } from '@/services/sheets';

const MAX_BYTES = 10 * 1024 * 1024;

/** File → Import: a CSV into a new sheet, or over the current sheet (a version is saved first by the server). */
export function ImportDialog({
  open,
  spreadsheetId,
  currentSheet,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  spreadsheetId: string;
  currentSheet: { id: string; name: string };
  onOpenChange(open: boolean): void;
  onImported(sheetId: string): void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'new_sheet' | 'replace_sheet'>('new_sheet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (next: boolean) => {
    if (!next) {
      setFile(null);
      setMode('new_sheet');
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!file) return setError('Choose a CSV file.');
    if (file.size > MAX_BYTES) return setError('File is larger than 10 MB.');
    setBusy(true);
    setError(null);
    try {
      const res = await sheetsService.importCsv(spreadsheetId, file, mode, mode === 'replace_sheet' ? currentSheet.id : undefined);
      toast.success(`Imported ${res.rows.toLocaleString()} row${res.rows === 1 ? '' : 's'}`);
      onImported(res.sheetId);
      reset(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent title="Import CSV">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-label="CSV file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="block w-full text-sm"
        />
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="mb-1 font-medium">Import location</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="import-mode" checked={mode === 'new_sheet'} onChange={() => setMode('new_sheet')} /> Create new sheet
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="import-mode" checked={mode === 'replace_sheet'} onChange={() => setMode('replace_sheet')} /> Replace current sheet
          </label>
          {mode === 'replace_sheet' && (
            <p className="text-xs text-muted">
              This replaces all data on {currentSheet.name}. A version is saved first, so you can restore it from version history.
            </p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter className="mt-4">
          <Button variant="subtle" onClick={() => reset(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!file}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
