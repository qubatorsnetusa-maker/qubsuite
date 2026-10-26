import { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api';
import { sheetsService } from '@/services/sheets';

const MAX_BYTES = 25 * 1024 * 1024;

/** File → Import: CSV or Excel (.xlsx) into a new sheet, or over current sheet. */
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
    if (!file) return setError('Choose an Excel (.xlsx) or CSV file.');
    if (file.size > MAX_BYTES) return setError('File is larger than 25 MB.');
    setBusy(true);
    setError(null);
    try {
      let fileToUpload = file;
      if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName || !workbook.Sheets[sheetName]) {
          throw new Error('No worksheets found in this Excel workbook.');
        }
        const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        fileToUpload = new File([csvContent], file.name.replace(/\.[^/.]+$/, '.csv'), { type: 'text/csv' });
      }

      const res = await sheetsService.importCsv(spreadsheetId, fileToUpload, mode, mode === 'replace_sheet' ? currentSheet.id : undefined);
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
      <DialogContent title="Import Excel or CSV">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          aria-label="Spreadsheet file"
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
