import { AiAssistIcon } from '@/components/ai-assist-icon';
import React, { useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Bot,
  FileText,
  Upload,
  Layers,
  Palette,
  Check,
  Loader2,
  X,
  FileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import type { SlideTheme } from './slides-types';
import { SLIDE_THEMES } from './slides-types';
import { generateSlidesWithAi } from './ai-slide-generator';
import { saveDeck } from './slides-storage';
import { cn } from '@/lib/utils';

export interface AiGenerateDialogProps {
  isOpen: boolean;
  onClose(): void;
}

export function AiGenerateDialog({ isOpen, onClose }: AiGenerateDialogProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState<number>(5);
  const [theme, setTheme] = useState<SlideTheme>('dark-modern');
  const [includeImages, setIncludeImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Analyzing document structure...');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
        const content = await file.text();
        setText(content);
        toast.success(`Loaded ${file.name}`);
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        setText(res.value);
        toast.success(`Extracted text from ${file.name}`);
      } else {
        const content = await file.text();
        setText(content);
        toast.success(`Loaded ${file.name}`);
      }
    } catch {
      toast.error('Could not read the document content.');
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.warning('Please paste some text or upload a document first.');
      return;
    }

    setIsGenerating(true);

    // Progress animation ticker
    const timer1 = setTimeout(() => setProgressMsg('Formulating strategic slide layouts & key points...'), 700);
    const timer2 = setTimeout(() => setProgressMsg('Curating high-resolution visual imagery...'), 1400);
    const timer3 = setTimeout(() => setProgressMsg('Applying typography & design system...'), 2100);

    try {
      const deck = await generateSlidesWithAi({
        rawText: text,
        slideCount,
        theme,
        includeImages,
      });

      saveDeck(deck);
      toast.success(`Generated "${deck.title}" with ${deck.slides.length} slides!`);
      onClose();
      void navigate({ to: `/slides/$deckId` as any, params: { deckId: deck.id } as any });
    } catch {
      toast.error('Failed to generate presentation.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsGenerating(false);
    }
  };

  const SAMPLE_TEXT = `Project Titan: Quarterly Strategic Architecture Brief
Executive Overview:
In Q3, our cloud engineering teams successfully rolled out distributed real-time collaboration across Docs, Sheets, and Forms. Overall platform adoption increased by 4.8x year-over-year.

Core Pillars of Innovation:
- High-Performance State Engine: CRDT and Yjs synchronization providing sub-50ms keystroke presence.
- Enterprise Multi-Tenant Security: Role-based permissions, direct password challenges, and link expiration.
- Autonomous AI Productivity: Natural language formula synthesis and instant presentation design.

Key Milestone:
99.98% service uptime sustained during peak concurrent user spikes across 12 countries.

Next Steps for Q4:
Complete native mobile PWA deployment, expand AI layout intelligence, and launch the presentation keynote engine.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-slides-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-2xl animate-pop-in text-foreground flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 text-amber-500 border border-amber-500/20">
              <AiAssistIcon className="size-5 text-amber-500" />
            </div>
            <div>
              <h2 id="ai-slides-title" className="font-bold text-base">
                Design Slides with AI
              </h2>
              <p className="text-xs text-muted">
                Paste notes, an article, or upload a document to auto-generate beautiful slides.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-foreground transition-colors disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Tabs: Paste Text vs Upload File */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-2 border border-border">
            <button
              onClick={() => setMode('paste')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                mode === 'paste'
                  ? 'bg-surface-1 text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Text / Notes</span>
            </button>
            <button
              onClick={() => setMode('upload')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                mode === 'upload'
                  ? 'bg-surface-1 text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          {/* Text input area or Upload Area */}
          {mode === 'paste' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Source Content</span>
                {!text && (
                  <button
                    onClick={() => setText(SAMPLE_TEXT)}
                    className="text-blue-500 hover:underline font-medium text-[11px]"
                  >
                    Paste sample brief
                  </button>
                )}
              </div>
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your meeting notes, report, sermon outline, or product brief here..."
                className="w-full text-xs p-3.5 rounded-xl border border-border bg-surface-2 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.docx"
                onChange={handleFileUpload}
                hidden
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-surface-2 hover:bg-surface-2/80 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1">
                  <FileUp className="w-6 h-6" />
                </div>
                <span className="font-semibold text-xs">
                  {fileName ? fileName : 'Click to select or drop a document'}
                </span>
                <span className="text-[11px] text-muted">
                  Supports Word (.docx), Markdown (.md), and Plain Text (.txt)
                </span>
              </div>
              {text && (
                <div className="p-3 rounded-lg bg-surface-2 border border-border text-[11px] text-muted flex items-center justify-between">
                  <span>Document parsed ({text.length.toLocaleString()} characters)</span>
                  <button onClick={() => setText('')} className="text-red-400 hover:underline">
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
            {/* Slide Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted" />
                <span>Presentation Length</span>
              </label>
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface-2 focus:outline-none focus:border-blue-500"
              >
                <option value={3}>3-4 slides (Executive Summary)</option>
                <option value={5}>5-6 slides (Standard Pitch Deck)</option>
                <option value={8}>8-10 slides (Comprehensive Keynote)</option>
              </select>
            </div>

            {/* Visual Theme */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-muted" />
                <span>Design Theme</span>
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as SlideTheme)}
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface-2 focus:outline-none focus:border-blue-500"
              >
                {(Object.keys(SLIDE_THEMES) as SlideTheme[]).map((thm) => (
                  <option key={thm} value={thm}>
                    {SLIDE_THEMES[thm].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Images Checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              className="w-4 h-4 rounded border-border text-blue-600 focus:ring-0"
            />
            <span className="text-xs font-medium">
              Curate matching high-resolution visual imagery for key slides
            </span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border px-6 py-4 bg-surface-2 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted">
            {isGenerating && (
              <div className="flex items-center gap-2 text-blue-500 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{progressMsg}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-hover transition-colors disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all disabled:opacity-40"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Designing Deck...</span>
                </>
              ) : (
                <>
                  <AiAssistIcon className="size-3.5 text-indigo-200" />
                  <span>Generate with AI Assist</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
