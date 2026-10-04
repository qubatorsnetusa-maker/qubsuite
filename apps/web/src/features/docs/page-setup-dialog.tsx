import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type PaperSize = 'letter' | 'a4' | 'legal' | 'a3';
export type Orientation = 'portrait' | 'landscape';

export interface PageSetupConfig {
  orientation: Orientation;
  paperSize: PaperSize;
  pageColor: string;
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
];

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

  useEffect(() => {
    if (open) {
      setOrientation(config.orientation);
      setPaperSize(config.paperSize);
      setPageColor(config.pageColor);
    }
  }, [open, config]);

  const handleApply = () => {
    onSave({ orientation, paperSize, pageColor });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Page Setup" className="max-w-md">
        <div className="space-y-5 py-2">
          {/* Orientation */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orientation</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                  orientation === 'portrait'
                    ? 'border-blue-600 bg-blue-50/50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    : 'border-border hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="h-10 w-7 rounded-xs border-2 border-current" />
                <span>Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                  orientation === 'landscape'
                    ? 'border-blue-600 bg-blue-50/50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    : 'border-border hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="h-7 w-10 rounded-xs border-2 border-current" />
                <span>Landscape</span>
              </button>
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paper Size</label>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {(Object.keys(PAPER_SIZES) as PaperSize[]).map((k) => (
                <option key={k} value={k}>
                  {PAPER_SIZES[k].name} ({PAPER_SIZES[k].label})
                </option>
              ))}
            </select>
          </div>

          {/* Page Background Tint */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Color</label>
            <div className="mt-2 flex items-center gap-2">
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
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="bg-blue-600 text-white hover:bg-blue-700">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
