import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type PaperSize = 'letter' | 'a4' | 'legal' | 'a3';
export type Orientation = 'portrait' | 'landscape';

export interface PageSetupConfig {
  orientation: Orientation;
  paperSize: PaperSize;
  pageColor: string;
  columns?: 1 | 2 | 3;
  pageless?: boolean;
  watermark?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
}

export const PAPER_SIZES: Record<PaperSize, { name: string; portraitWidth: number; portraitHeight: number; label: string }> = {
  letter: { name: 'Letter', portraitWidth: 816, portraitHeight: 1056, label: '8.5" × 11"' },
  a4: { name: 'A4', portraitWidth: 794, portraitHeight: 1123, label: '210 × 297 mm' },
  legal: { name: 'Legal', portraitWidth: 816, portraitHeight: 1344, label: '8.5" × 14"' },
  a3: { name: 'A3', portraitWidth: 1123, portraitHeight: 1587, label: '297 × 420 mm' },
};

const PAGE_COLORS = [
  { name: 'White', color: '#ffffff' },
  { name: 'Warm Cream', color: '#fbf9f4' },
  { name: 'Soft Gray', color: '#f8f9fa' },
  { name: 'Muted Blue', color: '#f1f5f9' },
  { name: 'Sepia', color: '#f4ecd8' },
  { name: 'Soft Mint', color: '#f0fdf4' },
];

const WATERMARK_PRESETS = ['', 'CONFIDENTIAL', 'DRAFT', 'INTERNAL USE ONLY', 'APPROVED', 'SAMPLE'];

interface PageSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: PageSetupConfig;
  onSave: (config: PageSetupConfig) => void;
}

export function PageSetupDialog({ open, onOpenChange, config, onSave }: PageSetupDialogProps) {
  const [orientation, setOrientation] = useState<Orientation>(config.orientation);
  const [paperSize, setPaperSize] = useState<PaperSize>(config.paperSize);
  const [pageColor, setPageColor] = useState<string>(config.pageColor);
  const [columns, setColumns] = useState<1 | 2 | 3>(config.columns ?? 1);
  const [pageless, setPageless] = useState<boolean>(config.pageless ?? false);
  const [watermark, setWatermark] = useState<string>(config.watermark ?? '');
  const [headerText, setHeaderText] = useState<string>(config.headerText ?? '');
  const [footerText, setFooterText] = useState<string>(config.footerText ?? '');
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(config.showPageNumbers ?? false);

  useEffect(() => {
    if (open) {
      setOrientation(config.orientation);
      setPaperSize(config.paperSize);
      setPageColor(config.pageColor);
      setColumns(config.columns ?? 1);
      setPageless(config.pageless ?? false);
      setWatermark(config.watermark ?? '');
      setHeaderText(config.headerText ?? '');
      setFooterText(config.footerText ?? '');
      setShowPageNumbers(config.showPageNumbers ?? false);
    }
  }, [open, config]);

  const handleApply = () => {
    onSave({
      orientation,
      paperSize,
      pageColor,
      columns,
      pageless,
      watermark: watermark.trim(),
      headerText: headerText.trim(),
      footerText: footerText.trim(),
      showPageNumbers,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Page Setup & Document Layout" className="max-w-lg">
        <div className="space-y-4 py-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Canvas Mode: Pages vs Pageless */}
          <div className="grid grid-cols-2 gap-2.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setPageless(false)}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                !pageless ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pages (Print Layout)
            </button>
            <button
              type="button"
              onClick={() => setPageless(true)}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                pageless ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pageless (Wide Canvas)
            </button>
          </div>

          {/* Orientation & Paper Size */}
          {!pageless && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Orientation
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-all ${
                      orientation === 'portrait'
                        ? 'border-blue-600 bg-blue-50/50 font-semibold text-blue-700'
                        : 'border-border hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="h-7 w-5 rounded-xs border-2 border-current" />
                    <span>Portrait</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-all ${
                      orientation === 'landscape'
                        ? 'border-blue-600 bg-blue-50/50 font-semibold text-blue-700'
                        : 'border-border hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="h-5 w-7 rounded-xs border-2 border-current" />
                    <span>Landscape</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paper Size
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {(Object.keys(PAPER_SIZES) as PaperSize[]).map((k) => (
                    <option key={k} value={k}>
                      {PAPER_SIZES[k].name} ({PAPER_SIZES[k].label})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Multi-Column Layout */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Text Columns
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((colCount) => (
                <button
                  key={colCount}
                  type="button"
                  onClick={() => setColumns(colCount)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    columns === colCount
                      ? 'border-blue-600 bg-blue-50/60 text-blue-700 font-semibold'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {colCount} {colCount === 1 ? 'Column' : 'Columns'}
                </button>
              ))}
            </div>
          </div>

          {/* Headers, Footers & Page Numbers */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Headers, Footers & Watermark
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span className="text-[11px] font-medium text-slate-600">Running Header Text</span>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="e.g. QubSuite Executive Proposal"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-600">Running Footer Text</span>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="e.g. Strictly Confidential"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPageNumbers}
                  onChange={(e) => setShowPageNumbers(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Display page numbering in footer</span>
              </label>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-600">Diagonal Page Watermark</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  placeholder="None (or type CONFIDENTIAL, DRAFT...)"
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={WATERMARK_PRESETS.includes(watermark) ? watermark : '__custom'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom') setWatermark(e.target.value);
                  }}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">No Watermark</option>
                  {WATERMARK_PRESETS.filter(Boolean).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Page Background Tint */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Page Background Tint
            </label>
            <div className="mt-2 flex items-center gap-2.5">
              {PAGE_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setPageColor(c.color)}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                  className={`h-7 w-7 rounded-full border shadow-2xs transition-transform hover:scale-110 ${
                    pageColor === c.color ? 'ring-2 ring-blue-600 ring-offset-2' : 'border-slate-300'
                  }`}
                />
              ))}
              <label
                className="flex items-center gap-1.5 ml-2 text-xs text-slate-600 cursor-pointer"
                title="Pick custom page color"
              >
                <input
                  type="color"
                  value={pageColor}
                  onChange={(e) => setPageColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                />
                <span>Custom</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="bg-blue-600 text-white hover:bg-blue-700">
            Apply Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
