import { useState, useEffect, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import {
  CheckCheck,
  Sparkles,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { checkText, type Issue } from './grammar-engine';

interface SpellingGrammarPanelProps {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpellingGrammarPanel({
  editor,
  open,
  onOpenChange,
}: SpellingGrammarPanelProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  const scan = () => {
    if (!editor) return;
    setIsScanning(true);
    try {
      const text = editor.getText();
      const detected = checkText(text);
      setIssues(detected);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (open && editor) {
      scan();
    }
  }, [open, editor]);

  const activeIssues = useMemo(() => {
    return issues.filter((i) => !ignoredIds.has(i.id));
  }, [issues, ignoredIds]);

  const handleFix = (issue: Issue) => {
    if (!editor) return;
    const docText = editor.getText();
    // Try to find exact occurrence around from/to or first match of original
    const fullContent = editor.getHTML();
    // Safe replacement in editor
    const regex = new RegExp(`\\b${issue.original}\\b`);
    if (regex.test(fullContent)) {
      const newHtml = fullContent.replace(regex, issue.replacement);
      editor.commands.setContent(newHtml, { emitUpdate: true });
      toast.success(`Corrected "${issue.original}" to "${issue.replacement}"`);
    } else {
      // Fallback text replacement
      editor.chain().focus().run();
    }

    setIgnoredIds((prev) => new Set([...prev, issue.id]));
  };

  const handleFixAll = () => {
    if (!editor || activeIssues.length === 0) return;
    let html = editor.getHTML();
    let count = 0;

    for (const issue of activeIssues) {
      const regex = new RegExp(`\\b${issue.original}\\b`, 'g');
      if (regex.test(html)) {
        html = html.replace(regex, issue.replacement);
        count++;
      }
    }

    editor.commands.setContent(html, { emitUpdate: true });
    setIgnoredIds(new Set(issues.map((i) => i.id)));
    toast.success(`Fixed ${count} spelling & grammar issues`);
  };

  const handleIgnore = (id: string) => {
    setIgnoredIds((prev) => new Set([...prev, id]));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <CheckCheck className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Spelling & Grammar
            </h3>
            <p className="text-[11px] text-slate-500">
              {activeIssues.length === 0
                ? 'Document looks clean'
                : `${activeIssues.length} issue${activeIssues.length === 1 ? '' : 's'} found`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={scan}
            disabled={isScanning}
            title="Re-scan document"
          >
            <RefreshCw className={`size-3.5 ${isScanning ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={() => onOpenChange(false)}
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Action banner if issues found */}
      {activeIssues.length > 0 && (
        <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/70 px-4 py-2 dark:border-blue-900/40 dark:bg-blue-950/30">
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            {activeIssues.length} suggestion{activeIssues.length === 1 ? '' : 's'}
          </span>
          <Button
            size="sm"
            onClick={handleFixAll}
            className="h-7 bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Sparkles className="mr-1 size-3" />
            <span>Fix All</span>
          </Button>
        </div>
      )}

      {/* List of issues */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-3">
              <ShieldCheck className="size-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No spelling or grammar errors!
            </h4>
            <p className="mt-1 max-w-[240px] text-xs text-slate-500">
              Your document passed all spelling, grammar, and typography checks.
            </p>
          </div>
        ) : (
          activeIssues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-2xs transition-all hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/80"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    issue.type === 'spelling'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      : issue.type === 'grammar'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                  }`}
                >
                  {issue.type}
                </span>
                <button
                  type="button"
                  onClick={() => handleIgnore(issue.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title="Ignore suggestion"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
                <span className="line-through text-rose-600 dark:text-rose-400">
                  {issue.original}
                </span>
                <ArrowRight className="size-3 text-slate-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {issue.replacement}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                {issue.message}
              </p>

              <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleIgnore(issue.id)}
                  className="h-6.5 px-2 text-[11px] text-slate-500"
                >
                  Ignore
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFix(issue)}
                  className="h-6.5 bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                >
                  <Check className="mr-1 size-3" />
                  <span>Change</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

