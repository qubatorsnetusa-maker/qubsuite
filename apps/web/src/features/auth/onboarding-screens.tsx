import { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, FileCheck2, FileText, Table } from 'lucide-react';
import { QubMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ONBOARDING_COMPLETED_KEY = 'qub_onboarding_completed';

/**
 * Checks whether the current environment is a mobile app or mobile device.
 * Onboarding screens should only display on mobile, not web or desktop.
 */
export function isMobileClient(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Native Android app wrapper
  if (/QubDocsAndroid/i.test(ua)) return true;
  // Mobile phone / tablet devices
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  // Touch-enabled small viewport (mobile phones)
  if (window.innerWidth <= 768 && 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) {
    return true;
  }
  return false;
}

/**
 * Returns true if onboarding should be shown:
 * Only on mobile, when not yet completed in localStorage (or overridden by ?onboarding=true).
 */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('onboarding') === 'true') return true;
    if (!isMobileClient()) return false;
    return !localStorage.getItem(ONBOARDING_COMPLETED_KEY);
  } catch {
    return false;
  }
}

interface OnboardingScreensProps {
  onComplete: () => void;
}

interface OnboardingSlide {
  id: string;
  dotColor: string;
  iconBg: string;
  title: string;
  description: string;
  renderIcon: () => React.ReactNode;
}

export function OnboardingScreens({ onComplete }: OnboardingScreensProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slides: OnboardingSlide[] = [
    {
      id: 'docs',
      dotColor: 'bg-blue-600',
      iconBg: 'bg-blue-50 text-blue-600 ring-8 ring-blue-500/10',
      title: 'Smart Documents & Writing',
      description:
        'Create, format, and collaborate on professional documents with voice dictation, handwriting, and rich typography.',
      renderIcon: () => <FileText className="size-16 sm:size-20 text-blue-600 stroke-[1.6]" />,
    },
    {
      id: 'sheets',
      dotColor: 'bg-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600 ring-8 ring-emerald-500/10',
      title: 'Fast Sheets & Presentations',
      description:
        'Analyze figures with formulas and clean charts, and design impactful slide decks with blank canvases and AI assist.',
      renderIcon: () => <Table className="size-16 sm:size-20 text-emerald-600 stroke-[1.6]" />,
    },
    {
      id: 'forms',
      dotColor: 'bg-purple-600',
      iconBg: 'bg-purple-50 text-purple-600 ring-8 ring-purple-500/10',
      title: 'Forms, PDF Sign & Cloud Drive',
      description:
        'Collect responses with custom forms, sign PDF agreements, and protect your workspace with encrypted cloud storage.',
      renderIcon: () => <FileCheck2 className="size-16 sm:size-20 text-purple-600 stroke-[1.6]" />,
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {
      // Ignore localStorage restrictions
    }
    onComplete();
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const deltaX = touchStartX.current - touchEndX;

    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  const slide = slides[currentSlide]!;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative flex min-h-dvh w-full flex-col justify-between bg-white px-6 py-8 select-none"
    >
      {/* Top Bar: Clean Single Brand Mark & Skip Button */}
      <div className="flex items-center justify-between max-w-sm mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <QubMark size={28} />
          <span className="text-lg font-bold text-slate-900 tracking-tight">QubDocs</span>
        </div>
        <button
          type="button"
          onClick={handleFinish}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Center Hero: Single prominent icon and clear explanation */}
      <div className="flex flex-1 flex-col items-center justify-center text-center my-auto py-6 max-w-sm mx-auto">
        <div
          key={currentSlide}
          className={cn(
            'flex size-32 sm:size-36 items-center justify-center rounded-3xl transition-all duration-300 animate-in zoom-in-95 fade-in',
            slide.iconBg
          )}
        >
          {slide.renderIcon()}
        </div>

        <h2 className="mt-8 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {slide.title}
        </h2>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-xs">
          {slide.description}
        </p>
      </div>

      {/* Bottom Bar: 3 Dots and Action Buttons */}
      <div className="flex flex-col gap-5 max-w-sm mx-auto w-full pb-2">
        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                currentSlide === idx ? cn('w-7', s.dotColor) : 'w-2 bg-slate-200'
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 w-full">
          {currentSlide > 0 && (
            <Button
              variant="outline"
              onClick={handlePrev}
              className="h-12 px-5 rounded-xl text-slate-700 text-sm font-medium gap-1.5 shrink-0"
            >
              <ArrowLeft className="size-4" />
              <span>Back</span>
            </Button>
          )}

          <Button
            onClick={handleNext}
            className={cn(
              'h-12 px-6 rounded-xl text-white text-sm font-semibold shadow-md flex-1 gap-2 transition-all w-full',
              slide.dotColor,
              'hover:opacity-90 active:scale-95'
            )}
          >
            <span>{currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}</span>
            {currentSlide === slides.length - 1 ? (
              <Check className="size-4 stroke-[2.5]" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
