import { useState } from 'react';
import { PenTool, Sparkles, Loader2, Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/form-controls';
import { api, errorMessage } from '@/lib/api';
import { toast } from 'sonner';
import type { FormFieldType } from '@qub/shared';

interface FormAiProps {
  canEdit: boolean;
  onApplyGeneratedFields: (data: { title?: string; description?: string; fields: Array<{ label: string; type: FormFieldType; required: boolean; options?: string[] }> }) => void;
}

export function FormAiGenerator({ canEdit, onApplyGeneratedFields }: FormAiProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; description: string; fields: any[] } | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || prompt;
    if (!textToSubmit.trim() || loading) return;

    setLoading(true);
    setPreview(null);

    try {
      const res = await api<{ title: string; description: string; fields: any[] }>('/ai/forms/generate', {
        method: 'POST',
        body: {
          prompt: textToSubmit,
          fieldCount: questionCount,
        },
      });

      if (res && res.fields && res.fields.length > 0) {
        setPreview(res);
      } else {
        toast.error('AI could not generate questions. Try a more detailed prompt.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;

    // Map AI types to valid FormFieldType
    const mappedFields = preview.fields.map((f) => {
      let type: FormFieldType = 'SHORT_ANSWER';
      const rawType = (f.type || '').toLowerCase();
      if (rawType.includes('email')) type = 'EMAIL';
      else if (rawType.includes('number')) type = 'NUMBER';
      else if (rawType.includes('textarea') || rawType.includes('long') || rawType.includes('paragraph')) type = 'PARAGRAPH';
      else if (rawType.includes('select') || rawType.includes('drop')) type = 'DROPDOWN';
      else if (rawType.includes('check') || rawType.includes('multi')) type = 'CHECKBOXES';
      else if (rawType.includes('radio') || rawType.includes('single') || rawType.includes('choice')) type = 'MULTIPLE_CHOICE';
      else if (rawType.includes('rating') || rawType.includes('star')) type = 'RATING';
      else if (rawType.includes('date')) type = 'DATE';

      return {
        label: f.label || 'Question',
        type,
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options : undefined,
      };
    });

    onApplyGeneratedFields({
      title: preview.title,
      description: preview.description,
      fields: mappedFields,
    });

    toast.success(`Generated ${mappedFields.length} questions with AI!`);
    setOpen(false);
    setPreview(null);
    setPrompt('');
  };

  if (!canEdit) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
      >
        <PenTool className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span>Generate with AI</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Generate Form with AI" className="max-w-lg">
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                What kind of form do you want to create?
              </label>
              <Textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Customer satisfaction survey for a restaurant with rating, food quality, and feedback questions..."
                className="text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Number of questions:</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <option value={3}>3 questions</option>
                <option value={5}>5 questions</option>
                <option value={8}>8 questions</option>
                <option value={10}>10 questions</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Event RSVP & dietary preferences',
                'Job application questionnaire',
                'Product feedback & NPS score',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setPrompt(sug);
                    handleGenerate(sug);
                  }}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-purple-50 hover:text-purple-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {sug}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-purple-600" />
                <span>Designing form questions and options...</span>
              </div>
            )}

            {preview && !loading && (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-slate-50 p-3 space-y-2 dark:bg-slate-900/50">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{preview.title}</h4>
                  <p className="text-xs text-slate-500">{preview.description}</p>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {preview.fields.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{i + 1}. {f.label}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 dark:bg-slate-700">
                        {f.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {preview ? (
              <Button onClick={handleApply} className="bg-purple-600 text-white hover:bg-purple-700">
                Add to Form
              </Button>
            ) : (
              <Button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || loading}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                Generate Questions
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
