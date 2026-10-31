import { AiAssistIcon } from '@/components/ai-assist-icon';
import React, { useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  FileText,
  Upload,
  Layers,
  Palette,
  Loader2,
  X,
  FileUp,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import type { SlideTheme } from './slides-types';
import { SLIDE_THEMES, VISIBLE_SLIDE_THEMES } from './slides-types';
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
  const [theme, setTheme] = useState<SlideTheme>('royal-executive');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-pop-in text-slate-900 flex flex-col max-h-[92dvh] my-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-amber-500/15 via-purple-500/15 to-blue-500/15 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
              <AiAssistIcon className="size-5 text-purple-600" />
            </div>
            <div>
              <h2 id="ai-slides-title" className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Design Slides with AI
              </h2>
              <p className="text-xs text-slate-500 leading-normal">
                Paste notes, an article, or upload a document to auto-generate beautiful slides.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors disabled:opacity-30 shrink-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 bg-white">
          {/* Tabs: Paste Text vs Upload File */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setMode('paste')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                mode === 'paste'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <FileText className="size-3.5 text-blue-600" />
              <span>Paste Text / Notes</span>
            </button>
            <button
              onClick={() => setMode('upload')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                mode === 'upload'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Upload className="size-3.5 text-blue-600" />
              <span>Upload Document</span>
            </button>
          </div>

          {/* Text input area or Upload Area */}
          {mode === 'paste' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Source Content</span>
                {!text && (
                  <button
                    onClick={() => setText(SAMPLE_TEXT)}
                    className="text-blue-600 hover:underline font-semibold text-xs transition-colors"
                  >
                    Paste sample brief
                  </button>
                )}
              </div>
              <textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your meeting notes, report, sermon outline, or product brief here..."
                className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed shadow-2xs transition-colors"
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
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 sm:p-8 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="size-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                  <FileUp className="size-6" />
                </div>
                <span className="font-semibold text-xs sm:text-sm text-slate-800">
                  {fileName ? fileName : 'Click to select or drop a document'}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-500">
                  Supports Word (.docx), Markdown (.md), and Plain Text (.txt)
                </span>
              </div>
              {text && (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                  <span className="font-medium">Document parsed ({text.length.toLocaleString()} characters)</span>
                  <button onClick={() => setText('')} className="text-red-600 font-semibold hover:underline">
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-slate-200">
            {/* Slide Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="size-3.5 text-blue-600" />
                <span>Presentation Length</span>
              </label>
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
              >
                <option value={3}>3-4 slides (Executive Summary)</option>
                <option value={5}>5-6 slides (Standard Pitch Deck)</option>
                <option value={8}>8-10 slides (Comprehensive Keynote)</option>
              </select>
            </div>

            {/* Visual Theme */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="size-3.5 text-purple-600" />
                <span>Design Theme</span>
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as SlideTheme)}
                className="w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
              >
                {VISIBLE_SLIDE_THEMES.map((thm) => (
                  <option key={thm} value={thm}>
                    {SLIDE_THEMES[thm].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Images Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              className="size-4.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
            />
            <span className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
              Curate matching high-resolution visual imagery for key slides
            </span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs">
            {isGenerating && (
              <div className="flex items-center gap-2 text-blue-700 font-semibold">
                <Loader2 className="size-4 animate-spin text-blue-600 shrink-0" />
                <span className="truncate">{progressMsg}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 sm:flex-none h-10 sm:h-9 px-4 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className="flex-[2] sm:flex-none flex items-center justify-center gap-2 h-10 sm:h-9 px-5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Designing Deck...</span>
                </>
              ) : (
                <>
                  <AiAssistIcon className="size-4 text-white" />
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
