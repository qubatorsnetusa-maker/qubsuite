import type { CellRange, SheetOp } from '@qub/shared';
import { colToLetters } from '@qub/shared/formula';
import { Table, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  computePivotTable,
  extractTableData,
  generatePivotOps,
  type PivotAggregateFunc,
  type PivotConfig,
} from './pivot-engine';
import type { SheetStore } from './sheet-store';

interface SheetPivotDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  store: SheetStore;
  sheetId: string;
  currentRange: CellRange;
  onCreatePivotSheet(name: string, ops: SheetOp[]): void;
}

export function SheetPivotDialog({
  open,
  onOpenChange,
  store,
  sheetId,
  currentRange,
  onCreatePivotSheet,
}: SheetPivotDialogProps) {
  // Extract columns & records from current range
  const tableData = useMemo(() => {
    if (!open) return { headers: [], rows: [] };
    return extractTableData(store, sheetId, currentRange);
  }, [open, store, sheetId, currentRange]);

  const headers = tableData.headers;

  const [rowCol, setRowCol] = useState<number>(headers[0]?.col ?? currentRange.startCol);
  const [colCol, setColCol] = useState<number | undefined>(undefined);
  const [valCol, setValCol] = useState<number>(
    headers.length > 1 ? headers[headers.length - 1]!.col : currentRange.startCol,
  );
  const [aggregate, setAggregate] = useState<PivotAggregateFunc>('SUM');
  const [sheetName, setSheetName] = useState<string>('Pivot Table');

  // Compute live preview
  const pivotPreview = useMemo(() => {
    if (headers.length === 0 || tableData.rows.length === 0) return null;
    const config: PivotConfig = {
      sourceSheetId: sheetId,
      sourceRange: currentRange,
      rowCol,
      columnCol: colCol,
      valCol,
      aggregate,
    };
    return computePivotTable(headers, tableData.rows, currentRange, config);
  }, [headers, tableData.rows, currentRange, sheetId, rowCol, colCol, valCol, aggregate]);

  const handleCreate = () => {
    if (!pivotPreview) return;
    const ops = generatePivotOps(pivotPreview, 'NEW_SHEET');
    onCreatePivotSheet(sheetName || 'Pivot Table', ops);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create Pivot Table" className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Rows field */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Rows (Group by)</label>
              <select
                value={rowCol}
                onChange={(e) => setRowCol(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                {headers.map((h) => (
                  <option key={h.col} value={h.col}>
                    {h.name} ({colToLetters(h.col)})
                  </option>
                ))}
              </select>
            </div>

            {/* Columns field (optional) */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Columns (Optional)</label>
              <select
                value={colCol === undefined ? 'none' : colCol}
                onChange={(e) => setColCol(e.target.value === 'none' ? undefined : Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="none">(None - 1D Table)</option>
                {headers.map((h) => (
                  <option key={h.col} value={h.col}>
                    {h.name} ({colToLetters(h.col)})
                  </option>
                ))}
              </select>
            </div>

            {/* Values field */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Values (Measure)</label>
              <select
                value={valCol}
                onChange={(e) => setValCol(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                {headers.map((h) => (
                  <option key={h.col} value={h.col}>
                    {h.name} ({colToLetters(h.col)})
                  </option>
                ))}
              </select>
            </div>

            {/* Aggregate function */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Summarize by</label>
              <select
                value={aggregate}
                onChange={(e) => setAggregate(e.target.value as PivotAggregateFunc)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="SUM">SUM (Total)</option>
                <option value="COUNT">COUNT (Number of items)</option>
                <option value="AVERAGE">AVERAGE (Mean)</option>
                <option value="MIN">MIN (Smallest)</option>
                <option value="MAX">MAX (Largest)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Sheet Tab Name</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="e.g. Pivot Summary"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Live Preview */}
          <div>
            <div className="text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
              <Table className="size-3.5" /> Live Preview
            </div>
            {pivotPreview ? (
              <div className="max-h-52 overflow-auto rounded-lg border border-border bg-surface-1 text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border font-semibold">
                      <th className="p-2 text-left">{pivotPreview.rowHeader}</th>
                      {pivotPreview.colKeys.map((c) => (
                        <th key={c} className="p-2 text-right">
                          {c}
                        </th>
                      ))}
                      {pivotPreview.colKeys.length > 1 && (
                        <th className="p-2 text-right bg-surface-3">Grand Total</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pivotPreview.rowKeys.map((rKey, rIdx) => (
                      <tr key={rKey} className="border-b border-border/60 hover:bg-black/5">
                        <td className="p-2 font-medium">{rKey}</td>
                        {pivotPreview.colKeys.map((_, cIdx) => (
                          <td key={cIdx} className="p-2 text-right tabular-nums">
                            {pivotPreview.matrix[rIdx]?.[cIdx]?.toLocaleString() ?? '—'}
                          </td>
                        ))}
                        {pivotPreview.colKeys.length > 1 && (
                          <td className="p-2 text-right font-semibold bg-surface-2/40 tabular-nums">
                            {pivotPreview.rowTotals[rIdx]?.toLocaleString() ?? '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Grand Total Footer */}
                    <tr className="bg-surface-2 font-bold border-t border-border">
                      <td className="p-2">Grand Total</td>
                      {pivotPreview.colKeys.map((_, cIdx) => (
                        <td key={cIdx} className="p-2 text-right tabular-nums">
                          {pivotPreview.colTotals[cIdx]?.toLocaleString() ?? '—'}
                        </td>
                      ))}
                      {pivotPreview.colKeys.length > 1 && (
                        <td className="p-2 text-right tabular-nums">
                          {pivotPreview.grandTotal?.toLocaleString() ?? '—'}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted border border-dashed border-border rounded-lg">
                Select a valid rectangular range with headers to compute a pivot table.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!pivotPreview}
            onClick={handleCreate}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Create Pivot Table Sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
