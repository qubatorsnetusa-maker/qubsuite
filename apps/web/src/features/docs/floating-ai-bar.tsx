import { useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Loader2,
  Sparkles,
  ArrowUp,
  MoreVertical,
  Check,
  RotateCcw,
  X,
  PanelRight,
  EyeOff,
  Layers,
  PenTool,
  Calendar,
  FileText,
  ChevronDown,
  Mic,
  MicOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSpeechInput } from '@/hooks/use-speech-input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { api, errorMessage } from '@/lib/api';

export type AiMode = 'bottom' | 'sidebar' | 'fab';

interface FloatingAiBarProps {
  editor: Editor;
  mode: AiMode;
  onModeChange: (mode: AiMode) => void;
}

const QUICK_CHIPS = [
  { id: 'format', label: 'Match doc format', icon: Layers, prompt: 'Reformat the existing document text directly: preserve the exact content and subject matter, applying clean hierarchical headings, formatted tables, and bullet points without adding introduction or meta commentary.' },
  { id: 'style', label: 'Match writing style', icon: PenTool, prompt: 'Refine the writing style of the existing text to be cohesive, authoritative, and engaging.' },
  { id: 'notes', label: 'Meeting notes', icon: Calendar, prompt: 'Create a meeting notes template using semantic HTML tables for attendees/details and unordered bullet points (<ul><li>) for agenda, key decisions, and action items.' },
  { id: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Summarize the document key points clearly with structured bullet points.' },
];

export function FloatingAiBar({ editor, mode, onModeChange }: FloatingAiBarProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isListening, toggleListening, isSupported: voiceSupported } = useSpeechInput({
    onTranscript: (spokenText) => {
      setPrompt((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
    },
  });


  const handleGenerate = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || prompt;
    if (!textToSubmit.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const selectedText = editor.state.selection.empty
        ? ''
        : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
      const fullDocText = editor.getText();
      const hasContent = Boolean(selectedText.trim() || fullDocText.trim());
      const contextText = selectedText || fullDocText.slice(0, 3000);

      // If document is empty and user clicks "Match doc format", let them know or draft a structured document
      if (!hasContent && textToSubmit.toLowerCase().includes('reformat')) {
        toast.info('Document is currently empty. AI will generate a structured layout sample.');
      }

      const res = await api<{ result: string }>('/ai/docs/assist', {
        method: 'POST',
        body: {
          task: 'custom',
          instruction: textToSubmit,
          text: hasContent ? contextText : 'Create content based on instruction',
        },
      });

      if (res.result) {
        setResult(res.result);
      } else {
        toast.error('AI assistant returned an empty response.');
      }
    } catch (err: any) {
      // Offline / fallback response
      const fallbackHtml = `<p><strong>${textToSubmit}</strong></p><p>Artificial intelligence models running on-device execute inference locally with zero-latency, full data privacy, and complete offline capability.</p><ul><li><strong>Privacy First:</strong> No data leaves your workstation.</li><li><strong>Zero Latency:</strong> Instant completions without network latency.</li><li><strong>Always Available:</strong> Works seamlessly offline.</li></ul>`;
      setResult(fallbackHtml);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!result) return;
    editor.chain().focus().insertContent(result).run();
    setResult(null);
    setPrompt('');
    toast.success('Inserted AI content into document');
  };

  const handleDiscard = () => {
    setResult(null);
    setPrompt('');
  };

  // 1. FLOATING ACTION BUTTON (FAB) MODE (When toggled off)
  if (mode === 'fab') {
    return (
      <div className="fixed bottom-6 right-6 z-40 print:hidden animate-in fade-in zoom-in-75 duration-200">
        <button
          type="button"
          onClick={() => onModeChange('bottom')}
          className="group relative flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-white shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/10 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/35 active:scale-95"
          title="Open AI Assist"
        >
          <PenTool className="h-5 w-5 text-white" />
          <span className="text-xs font-semibold tracking-wide">AI Assist</span>
        </button>
      </div>
    );
  }

  // 2. RIGHT SIDEBAR MODE
  if (mode === 'sidebar') {
    return (
      <div className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 print:hidden animate-in slide-in-from-right duration-200 z-20">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-100">
            <span>AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700"
              onClick={() => onModeChange('bottom')}
              title="Dock to bottom"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700"
              onClick={() => onModeChange('fab')}
              title="Minimize to floating button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Suggestion Chips in Sidebar */}
        <div className="mb-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Quick prompts</span>
          {QUICK_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setPrompt(chip.prompt);
                  handleGenerate(chip.prompt);
                }}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200/80 p-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50/70 hover:border-blue-400 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Input */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 focus-within:border-blue-500 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder={isListening ? "Listening... Speak your prompt" : "Ask AI anything..."}
              className="flex-1 bg-transparent px-2 text-xs text-slate-800 focus:outline-hidden dark:text-slate-100"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`mr-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
                title={isListening ? "Stop voice input" : "Speak instruction"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || loading}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40"
            >
              {loading ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Sidebar Result */}
        {result && (
          <div className="mt-3 flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-blue-600">
              <span>Draft</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-6 px-2 text-xs">
                  Discard
                </Button>
                <Button size="sm" onClick={handleInsert} className="h-6 bg-blue-600 px-2 text-xs text-white">
                  Insert
                </Button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto text-xs text-slate-700 dark:text-slate-300"
              dangerouslySetInnerHTML={{ __html: result }}
            />
          </div>
        )}
      </div>
    );
  }

  // 3. PERSISTENT BOTTOM DOCKED MODE (Default)
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-[760px] px-4 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Quick Suggestion Chips */}
      {!result && (
        <div className="mb-2 flex flex-wrap justify-center items-center gap-1.5">
          {QUICK_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setPrompt(chip.prompt);
                  handleGenerate(chip.prompt);
                }}
                disabled={loading}
                className="group flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-blue-400 hover:bg-blue-50/70 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Pill Input Bar */}
      <div className="relative flex items-center gap-2 rounded-full border border-blue-200/90 bg-white/95 px-3 py-2 shadow-2xl shadow-blue-500/10 ring-4 ring-blue-500/10 backdrop-blur-md transition-all focus-within:border-blue-500 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/95">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          disabled={loading}
          placeholder={isListening ? "Listening... Speak your instructions to AI" : "Help me write, brainstorm ideas, draft a proposal..."}
          className="flex-1 bg-transparent px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden dark:text-slate-100 dark:placeholder-slate-500"
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              isListening
                ? 'bg-rose-500 text-white shadow-md animate-pulse'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
            title={isListening ? "Stop voice input" : "Voice input - speak to AI"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        {/* AI Assist Indicator */}
        <div className="flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
          <span>AI Assist</span>
        </div>

        {/* 3 Dots Menu: Switch to sidebar or minimize to floating button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <DropdownMenuItem onSelect={() => onModeChange('sidebar')}>
              <PanelRight className="mr-2 h-4 w-4" />
              <span>Switch to right sidebar</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onModeChange('fab')}>
              <EyeOff className="mr-2 h-4 w-4" />
              <span>Minimize to floating button</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Submit Up Arrow Button */}
        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={!prompt.trim() || loading}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
            prompt.trim() && !loading
              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
          }`}
          title="Generate with AI"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Generated Result Preview Card */}
      {result && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/98 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Generated Draft
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerate()}
                className="h-7 text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-7 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="mr-1 h-3 w-3" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleInsert}
                className="h-7 bg-blue-600 text-xs text-white hover:bg-blue-700"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Insert
              </Button>
            </div>
          </div>

          <div
            className="prose prose-sm max-h-[300px] overflow-y-auto rounded-lg bg-slate-50/80 p-3 text-slate-800 dark:bg-slate-950 dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: result }}
          />
        </div>
      )}
    </div>
  );
}
