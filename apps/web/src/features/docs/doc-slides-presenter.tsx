import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Palette,
  Clock,
  FileText,
  Play,
  RotateCcw,
} from 'lucide-react';
import { extractSlidesFromDoc, extractNodeText, type DocSlide } from './slides-extractor';
import { cn } from '@/lib/utils';

export type SlideTheme = 'dark-luxe' | 'clean-light' | 'gradient-dusk' | 'warm-editorial';

export interface DocSlidesPresenterProps {
  docContent: JSONContent | null | undefined;
  docTitle: string;
  isOpen: boolean;
  onClose(): void;
}

export function DocSlidesPresenter({ docContent, docTitle, isOpen, onClose }: DocSlidesPresenterProps) {
  const slides = useMemo(() => extractSlidesFromDoc(docContent, { docTitle }), [docContent, docTitle]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<SlideTheme>('clean-light');
  const [showNotes, setShowNotes] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer counter
  useEffect(() => {
    if (!isOpen || !timerRunning) return;
    const interval = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timerRunning]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(secondsElapsed / 60);
    const secs = secondsElapsed % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsElapsed]);

  // Handle auto-hide HUD on idle
  const handleMouseMove = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowHud(false);
    }, 3500);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const cycleTheme = useCallback(() => {
    const themes: SlideTheme[] = ['dark-luxe', 'clean-light', 'gradient-dusk', 'warm-editorial'];
    const nextIdx = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[nextIdx]!);
  }, [theme]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        }
        onClose();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentIndex(slides.length - 1);
      } else if (e.key.toLowerCase() === 't') {
        cycleTheme();
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextSlide, prevSlide, cycleTheme, toggleFullscreen, onClose, slides.length]);

  if (!isOpen) return null;

  const currentSlide = slides[currentIndex] || slides[0]!;
  const progressPercent = ((currentIndex + 1) / slides.length) * 100;

  // Theme styling definitions
  const themeClasses: Record<SlideTheme, { container: string; slide: string; title: string; subtitle: string; body: string }> = {
    'dark-luxe': {
      container: 'bg-[#090d16] text-slate-100',
      slide: 'bg-[#111726] border border-slate-800 shadow-2xl text-slate-200',
      title: 'text-white font-bold tracking-tight',
      subtitle: 'text-blue-400 font-medium',
      body: 'text-slate-300',
    },
    'clean-light': {
      container: 'bg-[#f1f3f7] text-slate-900',
      slide: 'bg-white border border-slate-200 shadow-2xl text-slate-800',
      title: 'text-slate-950 font-bold tracking-tight',
      subtitle: 'text-blue-600 font-medium',
      body: 'text-slate-700',
    },
    'gradient-dusk': {
      container: 'bg-gradient-to-br from-[#120b22] via-[#0b0f24] to-[#04060d] text-slate-100',
      slide: 'bg-[#15122e]/90 border border-purple-900/40 shadow-2xl backdrop-blur-md text-slate-200',
      title: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-100 to-indigo-200 font-bold tracking-tight',
      subtitle: 'text-pink-400 font-medium',
      body: 'text-slate-300',
    },
    'warm-editorial': {
      container: 'bg-[#f0ece1] text-[#2c241e]',
      slide: 'bg-[#fbf9f4] border border-[#ded5c5] shadow-2xl text-[#3b322a]',
      title: 'text-[#1e1712] font-serif font-bold tracking-tight',
      subtitle: 'text-[#8c5835] font-serif italic',
      body: 'text-[#423932]',
    },
  };

  const currentTheme = themeClasses[theme];

  return (
    <div
      className={cn('fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden', currentTheme.container)}
      onMouseMove={handleMouseMove}
    >
      {/* Top Header bar (auto-fades) */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between transition-opacity duration-300 z-10',
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm opacity-80 tracking-wide truncate max-w-sm">{docTitle}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 opacity-70">
            Slide {currentIndex + 1} of {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Elapsed Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-mono font-medium backdrop-blur-sm">
            <Clock className="w-3.5 h-3.5 opacity-70" />
            <span>{formattedTimer}</span>
            <button
              onClick={() => setTimerRunning((r) => !r)}
              className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
              title={timerRunning ? 'Pause timer' : 'Resume timer'}
            >
              <Play className={cn('w-3 h-3', timerRunning && 'text-emerald-400 fill-emerald-400')} />
            </button>
            <button
              onClick={() => setSecondsElapsed(0)}
              className="opacity-60 hover:opacity-100 transition-opacity"
              title="Reset timer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Theme Switcher Button */}
          <button
            onClick={cycleTheme}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
            title={`Theme: ${theme} (Press 'T' to cycle)`}
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
            title="Toggle fullscreen (Press 'F')"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors ml-2"
            title="Exit Presentation (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas (16:9 Aspect Ratio) */}
      <div className="relative w-[90vw] max-w-[1200px] aspect-[16/9] flex items-center justify-center p-4">
        <div
          key={currentSlide.id}
          className={cn(
            'w-full h-full rounded-2xl p-12 md:p-16 flex flex-col justify-between overflow-hidden transition-all duration-300',
            currentTheme.slide
          )}
        >
          {/* Slide Header */}
          <div className="space-y-3">
            <h1 className={cn('text-3xl md:text-5xl leading-tight', currentTheme.title)}>
              {currentSlide.title}
            </h1>
            {currentSlide.subtitle && (
              <h2 className={cn('text-lg md:text-2xl', currentTheme.subtitle)}>
                {currentSlide.subtitle}
              </h2>
            )}
          </div>

          {/* Slide Content */}
          <div className={cn('my-auto py-4 space-y-4 text-base md:text-xl leading-relaxed max-h-[60%] overflow-y-auto pr-2', currentTheme.body)}>
            {currentSlide.contentNodes.length === 0 ? (
              <div className="opacity-40 italic text-center py-8">Section Header</div>
            ) : (
              currentSlide.contentNodes.map((node, i) => (
                <RenderSlideNode key={i} node={node} />
              ))
            )}
          </div>

          {/* Slide Footer */}
          <div className="flex items-center justify-between text-xs opacity-50 pt-4 border-t border-current/10">
            <span>{docTitle}</span>
            <span>
              {currentIndex + 1} / {slides.length}
            </span>
          </div>
        </div>
      </div>

      {/* Speaker Notes Overlay Tray */}
      {showNotes && currentSlide.speakerNotes.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[80vw] max-w-2xl bg-black/85 text-slate-100 border border-white/20 rounded-xl p-4 shadow-2xl backdrop-blur-md z-20 text-sm">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
            <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide uppercase text-blue-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Speaker Notes</span>
            </div>
            <button onClick={() => setShowNotes(false)} className="hover:opacity-100 opacity-60">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {currentSlide.speakerNotes.map((note, idx) => (
              <p key={idx} className="text-slate-300">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation HUD */}
      <div
        className={cn(
          'absolute bottom-6 flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/60 text-white border border-white/15 shadow-2xl backdrop-blur-lg transition-opacity duration-300 z-10',
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <button
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous slide (Left Arrow / PageUp)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold px-2">
          {currentIndex + 1} / {slides.length}
        </span>

        <button
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
          className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next slide (Right Arrow / Space / PageDown)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="h-4 w-px bg-white/20 mx-1" />

        {/* Toggle Speaker Notes */}
        <button
          onClick={() => setShowNotes((n) => !n)}
          className={cn(
            'p-1.5 rounded-full hover:bg-white/20 transition-colors',
            showNotes && 'bg-blue-500/30 text-blue-400'
          )}
          title="Toggle Speaker Notes (Press 'N')"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar along very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

/** Helper component to render individual slide content nodes */
function RenderSlideNode({ node }: { node: JSONContent }) {
  if (node.type === 'paragraph') {
    const text = extractNodeText(node);
    if (!text.trim()) return null;
    return <p className="mb-2">{text}</p>;
  }

  if (node.type === 'bulletList') {
    return (
      <ul className="list-disc pl-6 space-y-2 mb-3">
        {(node.content ?? []).map((li, idx) => (
          <li key={idx}>{extractNodeText(li)}</li>
        ))}
      </ul>
    );
  }

  if (node.type === 'orderedList') {
    return (
      <ol className="list-decimal pl-6 space-y-2 mb-3">
        {(node.content ?? []).map((li, idx) => (
          <li key={idx}>{extractNodeText(li)}</li>
        ))}
      </ol>
    );
  }

  if (node.type === 'taskList') {
    return (
      <ul className="space-y-2 pl-2 mb-3">
        {(node.content ?? []).map((item, idx) => {
          const checked = !!item.attrs?.checked;
          return (
            <li key={idx} className="flex items-center gap-3">
              <span className={cn('w-4 h-4 rounded border flex items-center justify-center text-xs', checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-current/40')}>
                {checked ? '✓' : ''}
              </span>
              <span className={checked ? 'line-through opacity-60' : ''}>{extractNodeText(item)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (node.type === 'codeBlock') {
    const text = (node.content ?? []).map((c) => c.text ?? '').join('');
    return (
      <pre className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-sm overflow-x-auto text-blue-200">
        <code>{text}</code>
      </pre>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-1 italic opacity-90 my-2">
        {extractNodeText(node)}
      </blockquote>
    );
  }

  if (node.type === 'image') {
    return (
      <div className="flex justify-center my-3">
        <img
          src={node.attrs?.src}
          alt={node.attrs?.alt ?? 'Slide image'}
          className="max-h-64 object-contain rounded-lg shadow-md"
        />
      </div>
    );
  }

  return <div>{extractNodeText(node)}</div>;
}
