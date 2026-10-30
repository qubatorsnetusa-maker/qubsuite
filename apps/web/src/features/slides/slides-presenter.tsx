import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { PresentationDeck } from './slides-types';
import { SLIDE_THEMES } from './slides-types';
import { SlidesCanvas } from './slides-canvas';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Clock,
  FileText,
  Play,
  RotateCcw,
  Printer,
} from 'lucide-react';

export interface SlidesPresenterProps {
  deck: PresentationDeck;
  initialSlideIndex?: number;
  isOpen: boolean;
  onClose(): void;
}

export function SlidesPresenter({
  deck,
  initialSlideIndex = 0,
  isOpen,
  onClose,
}: SlidesPresenterProps) {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [showNotes, setShowNotes] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeConfig = SLIDE_THEMES[deck.theme] || SLIDE_THEMES['clean-corporate'];

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

  const handleMouseMove = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowHud(false);
    }, 3500);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.min(deck.slides.length - 1, prev + 1));
  }, [deck.slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

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
        setCurrentIndex(deck.slides.length - 1);
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextSlide, prevSlide, toggleFullscreen, onClose, deck.slides.length]);

  if (!isOpen) return null;

  const currentSlide = deck.slides[currentIndex] || deck.slides[0]!;
  const progressPercent = ((currentIndex + 1) / deck.slides.length) * 100;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden',
        themeConfig.canvasBg,
        themeConfig.textColor
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Top Header Bar */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between transition-opacity duration-300 z-10',
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm opacity-90 tracking-wide truncate max-w-sm">
            {deck.title}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 opacity-75 font-medium">
            Slide {currentIndex + 1} of {deck.slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Elapsed Timer HUD */}
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

          {/* Print/Save Slides */}
          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
            title="Print or Save Presentation as PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
            title="Toggle fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Presenter */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 transition-colors ml-2"
            title="Exit Presentation (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Presentation Stage */}
      <div
        key={currentSlide.id}
        className={cn(
          'relative w-[92vw] max-w-[1240px] flex items-center justify-center transition-all duration-300',
          currentSlide.style?.transition === 'zoom'
            ? 'animate-pop-in'
            : currentSlide.style?.transition === 'slide'
              ? 'animate-in slide-in-from-right-6 duration-300'
              : 'animate-fade-in'
        )}
      >
        <SlidesCanvas
          slide={currentSlide}
          theme={deck.theme}
          aspectRatio={deck.aspectRatio}
          slideNumber={currentIndex + 1}
          totalSlides={deck.slides.length}
          readOnly
        />
      </div>

      {/* Speaker Notes Overlay Tray */}
      {showNotes && currentSlide.speakerNotes && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[85vw] max-w-2xl bg-white/95 text-slate-800 border border-slate-200 rounded-xl p-4 shadow-2xl backdrop-blur-md z-20 text-sm">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
            <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide uppercase text-blue-600">
              <FileText className="w-3.5 h-3.5" />
              <span>Speaker Notes</span>
            </div>
            <button onClick={() => setShowNotes(false)} className="hover:opacity-100 opacity-60">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
            {currentSlide.speakerNotes}
          </p>
        </div>
      )}

      {/* Floating Bottom Navigation HUD */}
      <div
        className={cn(
          'absolute bottom-6 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 text-slate-800 border border-slate-200 shadow-xl backdrop-blur-lg transition-opacity duration-300 z-10',
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <button
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold px-2 tabular-nums">
          {currentIndex + 1} / {deck.slides.length}
        </span>

        <button
          onClick={nextSlide}
          disabled={currentIndex === deck.slides.length - 1}
          className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => setShowNotes((n) => !n)}
          className={cn(
            'p-1.5 rounded-full hover:bg-slate-100 transition-colors',
            showNotes && 'bg-blue-50 text-blue-600'
          )}
          title="Toggle Speaker Notes (N)"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
