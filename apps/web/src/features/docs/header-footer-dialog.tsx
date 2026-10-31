import { useState, useEffect } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

export interface HeaderFooterConfig {
  headerText: string;
  footerText: string;
  headerAlignment: 'left' | 'center' | 'right';
  footerAlignment: 'left' | 'center' | 'right';
  showPageNumbers: boolean;
  differentFirstPage: boolean;
}

interface HeaderFooterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: HeaderFooterConfig;
  onSave: (config: HeaderFooterConfig) => void;
}

export function HeaderFooterDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: HeaderFooterDialogProps) {
  const [headerText, setHeaderText] = useState(config.headerText || '');
  const [footerText, setFooterText] = useState(config.footerText || '');
  const [headerAlignment, setHeaderAlignment] = useState(config.headerAlignment || 'center');
  const [footerAlignment, setFooterAlignment] = useState(config.footerAlignment || 'center');
  const [showPageNumbers, setShowPageNumbers] = useState(config.showPageNumbers ?? true);
  const [differentFirstPage, setDifferentFirstPage] = useState(config.differentFirstPage ?? false);

  useEffect(() => {
    if (open) {
      setHeaderText(config.headerText || '');
      setFooterText(config.footerText || '');
      setHeaderAlignment(config.headerAlignment || 'center');
      setFooterAlignment(config.footerAlignment || 'center');
      setShowPageNumbers(config.showPageNumbers ?? true);
      setDifferentFirstPage(config.differentFirstPage ?? false);
    }
  }, [open, config]);

  const handleSave = () => {
    onSave({
      headerText: headerText.trim(),
      footerText: footerText.trim(),
      headerAlignment,
      footerAlignment,
      showPageNumbers,
      differentFirstPage,
    });
    toast.success('Updated header and footer');
    onOpenChange(false);
  };

  const handleClear = () => {
    setHeaderText('');
    setFooterText('');
    setShowPageNumbers(false);
    onSave({
      headerText: '',
      footerText: '',
      headerAlignment: 'center',
      footerAlignment: 'center',
      showPageNumbers: false,
      differentFirstPage: false,
    });
    toast.success('Cleared header and footer');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Header & Footer"
        description="Configure running headers, footers, and page numbers."
        className="max-w-md p-4 sm:p-6 select-none"
      >
        <div className="space-y-4 py-2">
          {/* Header section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Header Section
              </label>
              <div className="flex items-center gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setHeaderAlignment(align)}
                    className={`size-6 rounded flex items-center justify-center transition-colors ${
                      headerAlignment === align
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400'
                    }`}
                    title={`Align ${align}`}
                  >
                    {align === 'left' && <AlignLeft className="size-3" />}
                    {align === 'center' && <AlignCenter className="size-3" />}
                    {align === 'right' && <AlignRight className="size-3" />}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="e.g. Confidential · QubSuite Project Proposal"
              className="text-xs h-8"
            />
          </div>

          {/* Footer section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Footer Section
              </label>
              <div className="flex items-center gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setFooterAlignment(align)}
                    className={`size-6 rounded flex items-center justify-center transition-colors ${
                      footerAlignment === align
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400'
                    }`}
                    title={`Align ${align}`}
                  >
                    {align === 'left' && <AlignLeft className="size-3" />}
                    {align === 'center' && <AlignCenter className="size-3" />}
                    {align === 'right' && <AlignRight className="size-3" />}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. © 2026 Qubators Inc. All rights reserved."
              className="text-xs h-8"
            />
          </div>

          {/* Page numbers & options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
                className="size-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Include page numbers in footer ("Page 1 of N")
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={differentFirstPage}
                onChange={(e) => setDifferentFirstPage(e.target.checked)}
                className="size-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Different first page (suppress header & footer on title page)
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            Clear Header & Footer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
