import { AiAssistIcon } from '@/components/ai-assist-icon';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  Presentation,
  Play,
  Palette,
  Layout,
  FileText,
  ArrowLeft,
  Share2,
  Download,
  Trash2,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDeckById,
  saveDeck,
  addSlideToDeck,
  duplicateSlideInDeck,
  removeSlideFromDeck,
  reorderSlidesInDeck,
} from './slides-storage';
import type { PresentationDeck, SlideItem, SlideLayout, SlideTheme } from './slides-types';
import { SLIDE_THEMES, LAYOUT_DESCRIPTIONS } from './slides-types';
import { SlidesRail } from './slides-rail';
import { SlidesCanvas } from './slides-canvas';
import { SlidesPresenter } from './slides-presenter';
import { AiGenerateDialog } from './ai-generate-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setPageMetadata } from '@/lib/meta';

export function SlidesPage() {
  const params = useParams({ strict: false }) as { deckId?: string };
  const deckId = params.deckId ?? 'default';
  const navigate = useNavigate();

  const [deck, setDeck] = useState<PresentationDeck | null>(() => getDeckById(deckId));

  useEffect(() => {
    if (deck?.title) {
      setPageMetadata({
        title: deck.title,
        suiteName: 'Slides',
        description: 'Create and present beautiful slide decks with Qub Slides',
      });
    }
  }, [deck?.title]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPresenterOpen, setIsPresenterOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Sync from storage on mount
  useEffect(() => {
    const loaded = getDeckById(deckId);
    if (loaded) {
      setDeck(loaded);
    }
  }, [deckId]);

  // Global hotkey F5 for Presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setIsPresenterOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdateCurrentSlide = useCallback(
    (updatedSlide: SlideItem) => {
      if (!deck) return;
      const updatedSlides = [...deck.slides];
      updatedSlides[currentSlideIndex] = updatedSlide;
      const updatedDeck = { ...deck, slides: updatedSlides };
      setDeck(updatedDeck);
      saveDeck(updatedDeck);
    },
    [deck, currentSlideIndex]
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (!deck) return;
      const updated = { ...deck, title: newTitle };
      setDeck(updated);
      saveDeck(updated);
    },
    [deck]
  );

  const handleThemeChange = useCallback(
    (theme: SlideTheme) => {
      if (!deck) return;
      const updated = { ...deck, theme };
      setDeck(updated);
      saveDeck(updated);
      toast.success(`Theme updated to ${SLIDE_THEMES[theme].name}`);
    },
    [deck]
  );

  const handleLayoutChange = useCallback(
    (layout: SlideLayout) => {
      if (!deck) return;
      const currentSlide = deck.slides[currentSlideIndex];
      if (!currentSlide) return;
      const updatedSlide: SlideItem = { ...currentSlide, layout };
      handleUpdateCurrentSlide(updatedSlide);
      toast.success(`Layout changed to ${LAYOUT_DESCRIPTIONS[layout].label}`);
    },
    [deck, currentSlideIndex, handleUpdateCurrentSlide]
  );

  const handleAddSlide = useCallback(
    (layout: SlideLayout) => {
      if (!deck) return;
      const updated = addSlideToDeck(deck, layout, currentSlideIndex);
      setDeck(updated);
      setCurrentSlideIndex(currentSlideIndex + 1);
      toast.success('Slide added');
    },
    [deck, currentSlideIndex]
  );

  const handleDuplicateSlide = useCallback(
    (index: number) => {
      if (!deck) return;
      const updated = duplicateSlideInDeck(deck, index);
      setDeck(updated);
      setCurrentSlideIndex(index + 1);
      toast.success('Slide duplicated');
    },
    [deck]
  );

  const handleDeleteSlide = useCallback(
    (index: number) => {
      if (!deck || deck.slides.length <= 1) {
        toast.warning('A presentation must have at least one slide.');
        return;
      }
      const updated = removeSlideFromDeck(deck, index);
      setDeck(updated);
      setCurrentSlideIndex(Math.max(0, index - 1));
      toast.info('Slide deleted');
    },
    [deck]
  );

  const handleMoveSlide = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (!deck) return;
      const updated = reorderSlidesInDeck(deck, fromIdx, toIdx);
      setDeck(updated);
      setCurrentSlideIndex(toIdx);
    },
    [deck]
  );

  if (!deck) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Presentation className="w-12 h-12 text-blue-500 opacity-60" />
        <h2 className="text-xl font-bold">Presentation Not Found</h2>
        <p className="text-muted text-sm max-w-sm">
          The requested presentation could not be loaded or has been deleted.
        </p>
        <Button onClick={() => navigate({ to: '/slides' as any })}>
          Back to Presentations
        </Button>
      </div>
    );
  }

  const currentSlide = deck.slides[currentSlideIndex] || deck.slides[0]!;
  const currentTheme = SLIDE_THEMES[deck.theme] || SLIDE_THEMES['dark-modern'];

  return (
    <div className="h-screen flex flex-col bg-surface-1 overflow-hidden">
      {/* Top Header & Toolbar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-surface-2 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/slides' as any })}
            className="p-1.5 rounded-lg hover:bg-hover text-muted transition-colors"
            title="All Presentations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Presentation className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <input
              type="text"
              value={deck.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-current/30 focus:border-blue-500 focus:outline-none transition-colors px-1"
            />
            <span className="text-[10px] text-muted px-1">Saved locally</span>
          </div>
        </div>

        {/* Toolbar Center / Right */}
        <div className="flex items-center gap-2">
          {/* Layout Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-hover transition-colors border border-border">
                <Layout className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{LAYOUT_DESCRIPTIONS[currentSlide.layout].label}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(LAYOUT_DESCRIPTIONS) as SlideLayout[]).map((layout) => (
                <DropdownMenuItem key={layout} onSelect={() => handleLayoutChange(layout)}>
                  <div>
                    <div className="font-medium text-xs">{LAYOUT_DESCRIPTIONS[layout].label}</div>
                    <div className="text-[10px] text-muted">{LAYOUT_DESCRIPTIONS[layout].description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-hover transition-colors border border-border">
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{currentTheme.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SLIDE_THEMES) as SlideTheme[]).map((thm) => (
                <DropdownMenuItem key={thm} onSelect={() => handleThemeChange(thm)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-3 h-3 rounded-full', SLIDE_THEMES[thm].cardBg)} />
                    <span className="text-xs font-medium">{SLIDE_THEMES[thm].name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Designer Button */}
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm transition-all"
            title="AI Assist"
          >
            <AiAssistIcon className="size-3.5 text-indigo-200" />
            <span className="hidden sm:inline">AI Assist</span>
          </button>

          {/* Toggle Speaker Notes */}
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-hover transition-colors border border-border',
              notesOpen && 'bg-blue-500/10 text-blue-500 border-blue-500/40'
            )}
            title="Toggle Speaker Notes"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Notes</span>
          </button>

          {/* Present Button (Hero CTA) */}
          <button
            onClick={() => setIsPresenterOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors ml-1"
            title="Present Fullscreen (F5)"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Present</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Rail: Slide Thumbnails */}
        <SlidesRail
          slides={deck.slides}
          theme={deck.theme}
          currentIndex={currentSlideIndex}
          onSelectSlide={(idx) => setCurrentSlideIndex(idx)}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
        />

        {/* Center: Slide WYSIWYG Editing Canvas */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-900/5 dark:bg-black/30">
          <div className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8">
            <SlidesCanvas
              slide={currentSlide}
              theme={deck.theme}
              slideNumber={currentSlideIndex + 1}
              totalSlides={deck.slides.length}
              onUpdateSlide={handleUpdateCurrentSlide}
            />
          </div>

          {/* Collapsible Speaker Notes Drawer */}
          {notesOpen && (
            <div className="border-t border-slate-200 dark:border-slate-800 bg-surface-2 p-3 shrink-0 transition-all">
              <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
                <span>Speaker Notes (Slide {currentSlideIndex + 1})</span>
                <span className="text-[10px] lowercase opacity-70">Visible only to presenter</span>
              </div>
              <textarea
                rows={3}
                value={currentSlide.speakerNotes ?? ''}
                onChange={(e) => handleUpdateCurrentSlide({ ...currentSlide, speakerNotes: e.target.value })}
                placeholder="Type talking points or sermon cues here..."
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface-1 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}
        </main>
      </div>

      {/* Fullscreen Presenter Modal */}
      {isPresenterOpen && (
        <SlidesPresenter
          deck={deck}
          initialSlideIndex={currentSlideIndex}
          isOpen={isPresenterOpen}
          onClose={() => setIsPresenterOpen(false)}
        />
      )}

      {/* AI Presentation Generator Modal */}
      <AiGenerateDialog
        isOpen={aiOpen}
        onClose={() => {
          setAiOpen(false);
          const loaded = getDeckById(deckId);
          if (loaded) setDeck(loaded);
        }}
      />
    </div>
  );
}
