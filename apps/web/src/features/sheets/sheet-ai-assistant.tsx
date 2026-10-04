import { useState } from 'react';
import { PenTool, Sparkles, Loader2, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { toast } from 'sonner';

interface SheetAiProps {
  canEdit: boolean;
  onApplyFormula: (formula: string) => void;
  selectedRangeText?: string;
  sampleColumns?: { header: string; sampleData?: string[] }[];
}

export function SheetAiAssistant({ canEdit, onApplyFormula, selectedRangeText, sampleColumns }: SheetAiProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ formula: string; explanation: string } | null>(null);

  const handleGenerate = async (customInstruction?: string) => {
    const textToSubmit = customInstruction || prompt;
    if (!textToSubmit.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api<{ formula: string; explanation: string }>('/ai/sheets/formula', {
        method: 'POST',
        body: {
          instruction: textToSubmit,
          sampleColumns,
        },
      });

      if (res && res.formula) {
        setResult(res);
      } else {
        toast.error('Could not generate formula. Try rephrasing.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result?.formula) return;
    onApplyFormula(result.formula);
    toast.success(`Applied formula ${result.formula}`);
    setOpen(false);
    setResult(null);
    setPrompt('');
  };

  if (!canEdit) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-md bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60"
          title="Ask AI to write a formula"
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>AI Formula</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 shadow-xl" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <PenTool className="h-3.5 w-3.5" /> AI Formula Generator
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">What calculation do you want to perform?</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g. Sum column B if column A is 'Closed'"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              'Sum column B if column A > 100',
              'Calculate average of column C',
              'Lookup value in column A and return column D',
            ].map((eg) => (
              <button
                key={eg}
                type="button"
                onClick={() => {
                  setPrompt(eg);
                  handleGenerate(eg);
                }}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {eg}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Generating formula...</span>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-2 rounded-lg bg-blue-50/60 p-2.5 border border-blue-200/60 dark:bg-blue-950/40 dark:border-blue-900/40">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                  {result.formula}
                </span>
                <Button size="sm" onClick={handleApply} className="h-6 gap-1 bg-blue-600 px-2 text-[11px] text-white hover:bg-blue-700">
                  <Check className="h-3 w-3" /> Insert
                </Button>
              </div>
              {result.explanation && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {result.explanation}
                </p>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || loading}
                className="h-7 bg-blue-600 text-xs text-white hover:bg-blue-700"
              >
                Generate Formula
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
