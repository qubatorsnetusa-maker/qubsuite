import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Sparkles, Loader2, Check, FileText, Maximize2, Minimize2, CheckSquare, MessageSquareCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-controls';
import { Tooltip } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';

interface AiAssistantProps {
  editor: Editor;
}

type AiTask = 'summarize' | 'rewrite' | 'expand' | 'shorten' | 'critique' | 'custom';

function markdownTableToHtml(text: string): string {
  const lines = text.split('\n');
  const tableLines = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));

  if (tableLines.length >= 2) {
    let html = '<table class="border-collapse border border-slate-300 w-full my-4">';
    let inThead = true;

    for (const line of tableLines) {
      if (line.includes('---')) {
        inThead = false;
        continue;
      }
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (inThead) {
        html +=
          '<thead><tr>' +
          cells.map((c) => '<th class="border border-slate-300 bg-slate-100 p-2 font-semibold text-left">' + c + '</th>').join('') +
          '</tr></thead><tbody>';
        inThead = false;
      } else {
        html += '<tr>' + cells.map((c) => '<td class="border border-slate-300 p-2">' + c + '</td>').join('') + '</tr>';
      }
    }
    html += '</tbody></table>';

    const nonTable = lines.filter((l) => !l.trim().startsWith('|') || !l.trim().endsWith('|')).join('<p>');
    return nonTable ? `<p>${nonTable}</p>${html}` : html;
  }

  return text;
}

function cleanText(text: string): string {
  let cleaned = text
    .replace(/^```(?:html)?\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();

  return markdownTableToHtml(cleaned);
}

export function AiDocAssistant({ editor }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTask, setSelectedTask] = useState<AiTask>('rewrite');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const getSelectedOrFullText = () => {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      return editor.state.doc.textBetween(from, to, ' ');
    }
    return editor.getText();
  };

  const handleAction = async (task: AiTask) => {
    setSelectedTask(task);
    const text = getSelectedOrFullText().trim();

    if (!text && task !== 'custom') {
      toast.error('The document is empty. Type some content first.');
      return;
    }

    if (task === 'custom') {
      setPreviewResult(null);
      setOpen(true);
      return;
    }

    await executeAiRequest(task, text);
  };

  const executeAiRequest = async (task: AiTask, text: string, instruction?: string) => {
    setLoading(true);
    setOpen(true);
    setPreviewResult(null);

    try {
      const res = await api<{ result: string }>('/ai/docs/assist', {
        method: 'POST',
        body: {
          task,
          text: text || 'Create content based on instruction',
          instruction,
          tone: 'professional',
        },
      });

      setPreviewResult(cleanText(res.result));
    } catch (err) {
      toast.error(errorMessage(err));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const applyResult = () => {
    if (!previewResult) return;

    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().insertContent(previewResult).run();
    } else {
      editor.chain().focus().insertContent(previewResult).run();
    }

    toast.success('AI changes applied to document');
    setOpen(false);
    setPreviewResult(null);
    setCustomPrompt('');
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip content="Qub AI Assist">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 font-medium text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/50"
            >
              <Sparkles className="h-4 w-4 animate-pulse text-purple-600 dark:text-purple-400" />
              <span>AI Assist</span>
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>

        <DropdownMenuContent align="start" className="w-64 py-1.5">
          <DropdownMenuItem icon={<Sparkles className="text-purple-600" />} onClick={() => handleAction('rewrite')}>
            Rewrite & Polish
          </DropdownMenuItem>
          <DropdownMenuItem icon={<FileText />} onClick={() => handleAction('summarize')}>
            Summarize Key Points
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Maximize2 />} onClick={() => handleAction('expand')}>
            Elaborate & Expand
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Minimize2 />} onClick={() => handleAction('shorten')}>
            Shorten & Make Concise
          </DropdownMenuItem>
          <DropdownMenuItem icon={<CheckSquare />} onClick={() => handleAction('critique')}>
            Critique & Review
          </DropdownMenuItem>
          <DropdownMenuItem icon={<MessageSquareCode />} onClick={() => handleAction('custom')}>
            Custom Instruction...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Qub AI Document Assistant" className={previewResult ? 'max-w-2xl' : 'max-w-md'}>
          <div className="space-y-4 py-2">
            {selectedTask === 'custom' && !previewResult && (
              <div className="space-y-2">
                <label className="text-sm font-medium">What would you like AI to do?</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Create a 4x4 milestone table, translate, etc."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customPrompt.trim()) {
                        executeAiRequest('custom', getSelectedOrFullText(), customPrompt);
                      }
                    }}
                  />
                  <Button
                    onClick={() => executeAiRequest('custom', getSelectedOrFullText(), customPrompt)}
                    disabled={!customPrompt.trim() || loading}
                  >
                    Generate
                  </Button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-purple-600" />
                <span className="font-medium">Generating...</span>
              </div>
            )}

            {previewResult && !loading && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Suggestion:
                </label>
                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-900 shadow-inner dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-100">
                  {previewResult.includes('<table') || previewResult.includes('<p>') ? (
                    <div
                      className="[&_table]:w-full [&_table]:border-collapse [&_table]:table-fixed [&_th]:border [&_th]:border-[#c4c7c5] [&_th]:bg-[#f1f3f4] [&_th]:p-2.5 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-[#c4c7c5] [&_td]:p-2.5 [&_td]:align-top"
                      dangerouslySetInnerHTML={{ __html: previewResult }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{previewResult}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-3 pt-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {previewResult && !loading && (
              <Button onClick={applyResult} className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700">
                <Check className="h-4 w-4" />
                <span>Replace / Insert Into Doc</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
