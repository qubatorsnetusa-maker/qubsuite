import { AiAssistIcon } from '@/components/ai-assist-icon';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  Presentation,
  Play,
  Palette,
  Layout,
  FileText,
  ArrowLeft,
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Type,
  Bookmark,
  Copy,
  Trash2,
  Plus,
  Monitor,
  Upload,
  Link2,
  Check,
  X,
  Shapes,
  Grid,
  Download,
  Table as TableIcon,
  BarChart3,
  Columns3,
  GitCommitHorizontal,
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
import type {
  PresentationDeck,
  SlideElementType,
  SlideFontFamily,
  SlideFontSize,
  SlideIconName,
  SlideImageFit,
  SlideImagePosition,
  SlideImageRounded,
  SlideItem,
  SlideLayout,
  SlideTextAlign,
  SlideTheme,
  SlideTransition,
} from './slides-types';
import { SLIDE_THEMES, VISIBLE_SLIDE_THEMES, LAYOUT_DESCRIPTIONS } from './slides-types';
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

const CURATED_SLIDE_PHOTOS = [
  {
    label: 'Executive Boardroom',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Strategy Collaboration',
    url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Analytics & Growth',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Product Team',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Modern Architecture',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Ocean Horizon',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
  },
];

const SLIDE_BG_SWATCHES = [
  { label: 'Theme Default', value: '' },
  { label: 'Pure White', value: '#ffffff' },
  { label: 'Crisp Ice', value: '#f8fafc' },
  { label: 'Soft Sky', value: '#f0f9ff' },
  { label: 'Soft Violet', value: '#faf5ff' },
  { label: 'Warm Ivory', value: '#fffbeb' },
  { label: 'Soft Mint', value: '#ecfdf5' },
  { label: 'Soft Rose', value: '#fff1f2' },
];

const ACCENT_SWATCHES = [
  { label: 'Theme Default', value: '' },
  { label: 'Royal Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Violet', value: '#9333ea' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Crimson', value: '#e11d48' },
  { label: 'Slate', value: '#0f172a' },
];

const ICON_OPTIONS: { value: SlideIconName; label: string }[] = [
  { value: 'none', label: 'No Icon' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'compass', label: 'Compass' },
  { value: 'trending-up', label: 'Growth' },
  { value: 'target', label: 'Target' },
  { value: 'shield-check', label: 'Shield' },
  { value: 'file-text', label: 'Document' },
  { value: 'award', label: 'Award' },
  { value: 'layers', label: 'Layers' },
  { value: 'users', label: 'Team' },
  { value: 'bar-chart', label: 'Chart' },
  { value: 'globe', label: 'Global' },
  { value: 'book-open', label: 'Book' },
  { value: 'check-circle', label: 'Check' },
  { value: 'bookmark', label: 'Bookmark' },
];

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
  const [sorterView, setSorterView] = useState(false);
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const imageFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpdateSlideStyle = useCallback(
    (stylePatch: Partial<NonNullable<SlideItem['style']>>) => {
      if (!deck) return;
      const current = deck.slides[currentSlideIndex];
      if (!current) return;
      handleUpdateCurrentSlide({
        ...current,
        style: {
          ...(current.style ?? {}),
          ...stylePatch,
        },
      });
    },
    [deck, currentSlideIndex, handleUpdateCurrentSlide]
  );

  const handleInsertElement = useCallback(
    (type: SlideElementType, defaultText: string) => {
      if (!deck) return;
      const current = deck.slides[currentSlideIndex];
      if (!current) return;
      const count = (current.elements ?? []).length;
      const newElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        text: defaultText,
        x: Math.min(70, 12 + count * 6),
        y: Math.min(75, 18 + count * 8),
      };
      handleUpdateCurrentSlide({
        ...current,
        elements: [...(current.elements ?? []), newElement],
      });
      toast.success('Element added — drag the handle on the slide to reposition');
    },
    [deck, currentSlideIndex, handleUpdateCurrentSlide]
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

  const handleAspectRatioChange = useCallback(
    (aspectRatio: '16:9' | '4:3') => {
      if (!deck) return;
      const updated = { ...deck, aspectRatio };
      setDeck(updated);
      saveDeck(updated);
      toast.success(`Slide size set to ${aspectRatio}`);
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

  const handleUploadSlideImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deck) return;
    const currentSlide = deck.slides[currentSlideIndex];
    if (!currentSlide) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        handleUpdateCurrentSlide({
          ...currentSlide,
          imageUrl: dataUrl,
          imageAlt: file.name.replace(/\.[^.]+$/, ''),
        });
        setImagePopoverOpen(false);
        toast.success('Image added to slide');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportHtmlDeck = () => {
    if (!deck) return;
    const themeSwatch = SLIDE_THEMES[deck.theme]?.swatchColor || '#2563eb';
    const slidesHtml = deck.slides
      .map(
        (s, idx) => `
      <section class="slide">
        <div class="bar" style="background:${s.style?.accentColor || themeSwatch}"></div>
        <div class="badge">${s.style?.badgeText || s.layout.toUpperCase()}</div>
        <h1>${s.title || ''}</h1>
        ${s.subtitle ? `<p class="sub">${s.subtitle}</p>` : ''}
        ${s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
        ${s.metric ? `<div class="metric"><strong>${s.metric.value}</strong><span>${s.metric.label}</span></div>` : ''}
        ${s.quote ? `<blockquote>“${s.quote.text}” <cite>— ${s.quote.author}</cite></blockquote>` : ''}
        <footer><span>${deck.title}</span><span>${idx + 1} / ${deck.slides.length}</span></footer>
      </section>`
      )
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${deck.title}</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #0f172a; padding: 32px; }
  .slide { position: relative; max-width: 960px; aspect-ratio: 16/9; margin: 0 auto 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 48px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 10px 30px rgba(15,23,42,0.06); page-break-after: always; overflow: hidden; }
  .bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${themeSwatch}; margin-bottom: 12px; }
  h1 { font-size: 38px; margin: 0 0 14px; color: #0f172a; }
  .sub { font-size: 20px; color: #475569; margin: 0 0 20px; }
  ul { font-size: 18px; color: #334155; line-height: 1.7; }
  .metric strong { display: block; font-size: 72px; color: ${themeSwatch}; }
  blockquote { font-size: 26px; font-style: italic; color: #1e293b; }
  footer { position: absolute; bottom: 20px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
</style>
</head>
<body>${slidesHtml}</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(deck.title || 'presentation').replace(/[^a-z0-9-_]+/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Standalone HTML presentation exported');
  };

  const handleExportJsonDeck = () => {
    if (!deck) return;
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(deck.title || 'presentation').replace(/[^a-z0-9-_]+/gi, '_')}.qubslides.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Presentation deck file exported');
  };

  if (!deck) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-50">
        <Presentation className="w-12 h-12 text-blue-500 opacity-60" />
        <h2 className="text-xl font-bold text-slate-900">Presentation Not Found</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          The requested presentation could not be loaded or has been deleted.
        </p>
        <Button onClick={() => navigate({ to: '/slides' as any })}>
          Back to Presentations
        </Button>
      </div>
    );
  }

  const currentSlide = deck.slides[currentSlideIndex] || deck.slides[0]!;
  const currentTheme = SLIDE_THEMES[deck.theme] || SLIDE_THEMES['clean-corporate'];
  const slideStyle = currentSlide.style ?? {};

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadSlideImage}
        className="hidden"
      />

      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/slides' as any })}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            title="All Presentations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-200/60">
            <Presentation className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <input
              type="text"
              value={deck.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-semibold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors px-1"
            />
            <span className="text-[10px] text-slate-400 px-1">All changes saved</span>
          </div>
        </div>

        {/* Primary Right Actions */}
        <div className="flex items-center gap-2">
          {/* Slide Sorter Grid View Toggle */}
          <button
            type="button"
            onClick={() => setSorterView((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border',
              sorterView
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            )}
            title="Toggle Slide Sorter Grid View"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{sorterView ? 'Editor View' : 'Slide Sorter'}</span>
          </button>

          {/* Theme Selector (Light Themes Only) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 bg-white text-slate-700">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">{currentTheme.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {VISIBLE_SLIDE_THEMES.map((thm) => (
                <DropdownMenuItem key={thm} onSelect={() => handleThemeChange(thm)}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: SLIDE_THEMES[thm].swatchColor }}
                      />
                      <span className="text-xs font-medium">{SLIDE_THEMES[thm].name}</span>
                    </div>
                    {deck.theme === thm && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Designer Button */}
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs transition-all"
            title="AI Assist"
          >
            <AiAssistIcon className="size-3.5 text-indigo-100" />
            <span className="hidden sm:inline">AI Assist</span>
          </button>

          {/* Toggle Speaker Notes */}
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 bg-white text-slate-700',
              notesOpen && 'bg-blue-50 text-blue-600 border-blue-200'
            )}
            title="Toggle Speaker Notes"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Notes</span>
          </button>

          {/* Export Presentation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 bg-white text-slate-700"
                title="Export Presentation"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden lg:inline">Export</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={handleExportHtmlDeck}>
                <div>
                  <div className="text-xs font-medium">Standalone HTML Deck (.html)</div>
                  <div className="text-[10px] text-slate-500">Self-contained printable slide deck</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.print()}>
                <div>
                  <div className="text-xs font-medium">Print / Save as PDF (.pdf)</div>
                  <div className="text-[10px] text-slate-500">Export via high-resolution print dialog</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportJsonDeck}>
                <div>
                  <div className="text-xs font-medium">QubSlides Deck Archive (.json)</div>
                  <div className="text-[10px] text-slate-500">Full editable presentation backup</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Present Button */}
          <button
            onClick={() => setIsPresenterOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            title="Present Fullscreen (F5)"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Present</span>
          </button>
        </div>
      </header>

      {/* Secondary PowerPoint-Style Formatting & Customization Ribbon */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 sm:px-4 py-1.5 flex items-center gap-2 text-xs shrink-0 z-20 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap">
        {/* Slide Actions */}
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
          <button
            type="button"
            onClick={() => handleAddSlide('title-content')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium shadow-2xs"
            title="Insert new slide"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>New Slide</span>
          </button>

          {/* Layout Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium shadow-2xs"
                title="Change slide layout"
              >
                <Layout className="w-3.5 h-3.5 text-slate-500" />
                <span>{LAYOUT_DESCRIPTIONS[currentSlide.layout]?.label ?? 'Layout'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
              {(Object.keys(LAYOUT_DESCRIPTIONS) as SlideLayout[]).map((layout) => (
                <DropdownMenuItem key={layout} onSelect={() => handleLayoutChange(layout)}>
                  <div>
                    <div className="font-medium text-xs">{LAYOUT_DESCRIPTIONS[layout].label}</div>
                    <div className="text-[10px] text-slate-500">{LAYOUT_DESCRIPTIONS[layout].description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Insert Shapes, Diagrams, Tables & Charts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium shadow-2xs"
                title="Insert shapes, callouts, tables, charts, or diagrams"
              >
                <Shapes className="w-3.5 h-3.5 text-indigo-600" />
                <span>Insert Element</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onSelect={() => handleInsertElement('text-box', 'Floating Text Box')}>
                <div className="flex items-center gap-2 text-xs">
                  <Type className="w-3.5 h-3.5 text-slate-500" />
                  <span>Floating Text Box</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleInsertElement('callout', 'Key Insight Callout')}>
                <div className="flex items-center gap-2 text-xs">
                  <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                  <span>Callout Highlight Box</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleInsertElement('pill-badge', 'NEW MILESTONE')}>
                <div className="flex items-center gap-2 text-xs">
                  <Shapes className="w-3.5 h-3.5 text-blue-600" />
                  <span>Pill Status Badge</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleInsertElement('rectangle', 'Executive Summary Card')}>
                <div className="flex items-center gap-2 text-xs">
                  <Layout className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Framed Accent Card</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleInsertElement('divider', '')}>
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Accent Divider Line</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleAddSlide('comparison-table')}>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>New Table Slide</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleAddSlide('chart-slide')}>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>New Data Chart Slide</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleAddSlide('timeline')}>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                  <GitCommitHorizontal className="w-3.5 h-3.5" />
                  <span>New Process Timeline Slide</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleAddSlide('three-column')}>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>New 3-Pillar Grid Slide</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Typography Controls: Font Family & Sizes */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
          <Type className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <select
            aria-label="Font family"
            value={slideStyle.fontFamily ?? 'sans'}
            onChange={(e) => handleUpdateSlideStyle({ fontFamily: e.target.value as SlideFontFamily })}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="sans">Inter Sans</option>
            <option value="serif">Editorial Serif</option>
            <option value="display">Modern Display</option>
            <option value="mono">Technical Mono</option>
          </select>

          <select
            aria-label="Title font size"
            value={slideStyle.titleSize ?? (currentSlide.layout === 'title' || currentSlide.layout === 'section' ? 'xl' : 'lg')}
            onChange={(e) => handleUpdateSlideStyle({ titleSize: e.target.value as SlideFontSize })}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            title="Heading size"
          >
            <option value="sm">Heading S</option>
            <option value="md">Heading M</option>
            <option value="lg">Heading L</option>
            <option value="xl">Heading XL</option>
          </select>

          <select
            aria-label="Body font size"
            value={slideStyle.bodySize ?? 'md'}
            onChange={(e) => handleUpdateSlideStyle({ bodySize: e.target.value as SlideFontSize })}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            title="Body text size"
          >
            <option value="sm">Body S</option>
            <option value="md">Body M</option>
            <option value="lg">Body L</option>
            <option value="xl">Body XL</option>
          </select>
        </div>

        {/* Text Alignment */}
        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-md p-0.5 pr-1">
          {(['left', 'center', 'right'] as SlideTextAlign[]).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => handleUpdateSlideStyle({ textAlign: align })}
              className={cn(
                'p-1 rounded transition-colors',
                (slideStyle.textAlign ?? 'left') === align
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              )}
              title={`Align ${align}`}
            >
              {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
              {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
              {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>

        {/* Media & Image Insertion */}
        <div className="relative flex items-center gap-1.5 pl-1 pr-2 border-r border-slate-200">
          <button
            type="button"
            onClick={() => setImagePopoverOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors shadow-2xs',
              currentSlide.imageUrl || imagePopoverOpen
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{currentSlide.imageUrl ? 'Slide Image' : 'Add Image'}</span>
          </button>

          {currentSlide.imageUrl && (
            <select
              aria-label="Image position"
              value={slideStyle.imagePosition ?? 'right'}
              onChange={(e) => handleUpdateSlideStyle({ imagePosition: e.target.value as SlideImagePosition })}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              title="Image placement"
            >
              <option value="right">Image Right</option>
              <option value="left">Image Left</option>
              <option value="top">Image Top</option>
              <option value="background">Soft Background</option>
            </select>
          )}

          {imagePopoverOpen && (
            <div className="absolute left-0 top-9 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-800">Insert & Format Visual</span>
                <button
                  type="button"
                  onClick={() => setImagePopoverOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 text-xs font-medium text-slate-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload Image from Device</span>
              </button>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="Paste image URL..."
                    className="w-full h-8 pl-8 pr-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={!customImageUrl.trim()}
                  onClick={() => {
                    handleUpdateCurrentSlide({ ...currentSlide, imageUrl: customImageUrl.trim() });
                    setCustomImageUrl('');
                    setImagePopoverOpen(false);
                  }}
                  className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40"
                >
                  Apply
                </button>
              </div>

              {/* Image Framing & Mask Controls */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Image Frame & Styling
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    aria-label="Image fit"
                    value={slideStyle.imageFit ?? 'cover'}
                    onChange={(e) => handleUpdateSlideStyle({ imageFit: e.target.value as SlideImageFit })}
                    className="h-7 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px]"
                  >
                    <option value="cover">Fit: Cover</option>
                    <option value="contain">Fit: Contain</option>
                  </select>
                  <select
                    aria-label="Image corner radius"
                    value={slideStyle.imageRounded ?? '2xl'}
                    onChange={(e) => handleUpdateSlideStyle({ imageRounded: e.target.value as SlideImageRounded })}
                    className="h-7 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px]"
                  >
                    <option value="none">Sharp</option>
                    <option value="md">Rounded</option>
                    <option value="2xl">Soft Card</option>
                    <option value="full">Circle/Pill</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleUpdateSlideStyle({ imageShadow: slideStyle.imageShadow === false })}
                    className={cn(
                      'h-7 rounded border text-[11px] font-medium',
                      slideStyle.imageShadow !== false
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    )}
                  >
                    {slideStyle.imageShadow !== false ? 'Shadow: On' : 'Shadow: Off'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Curated Keynote Visuals
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {CURATED_SLIDE_PHOTOS.map((photo) => (
                    <button
                      key={photo.label}
                      type="button"
                      onClick={() => {
                        handleUpdateCurrentSlide({
                          ...currentSlide,
                          imageUrl: photo.url,
                          imageAlt: photo.label,
                        });
                        setImagePopoverOpen(false);
                      }}
                      className="group relative aspect-[16/10] rounded-md overflow-hidden border border-slate-200 hover:border-blue-500"
                      title={photo.label}
                    >
                      <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Badge Icon Picker */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
          <Bookmark className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <select
            aria-label="Slide badge icon"
            value={slideStyle.iconName ?? 'none'}
            onChange={(e) => handleUpdateSlideStyle({ iconName: e.target.value as SlideIconName })}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            title="Slide header icon"
          >
            {ICON_OPTIONS.map((ic) => (
              <option key={ic.value} value={ic.value}>
                Icon: {ic.label}
              </option>
            ))}
          </select>
        </div>

        {/* Slide Background & Accent Swatches */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs text-slate-700"
                title="Customize slide surface color"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: slideStyle.backgroundColor || '#ffffff' }}
                />
                <span className="hidden xl:inline">Background</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {SLIDE_BG_SWATCHES.map((sw) => (
                <DropdownMenuItem
                  key={sw.label}
                  onSelect={() => handleUpdateSlideStyle({ backgroundColor: sw.value || undefined })}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: sw.value || '#ffffff' }}
                    />
                    <span className="text-xs">{sw.label}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs text-slate-700"
                title="Customize slide accent color"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: slideStyle.accentColor || currentTheme.swatchColor }}
                />
                <span className="hidden xl:inline">Accent</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {ACCENT_SWATCHES.map((sw) => (
                <DropdownMenuItem
                  key={sw.label}
                  onSelect={() => handleUpdateSlideStyle({ accentColor: sw.value || undefined })}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: sw.value || currentTheme.swatchColor }}
                    />
                    <span className="text-xs">{sw.label}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Transition & Slide Size (16:9 / 4:3) */}
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Slide transition"
            value={slideStyle.transition ?? 'fade'}
            onChange={(e) => handleUpdateSlideStyle({ transition: e.target.value as SlideTransition })}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            title="Slide transition effect"
          >
            <option value="none">Transition: None</option>
            <option value="fade">Transition: Smooth Fade</option>
            <option value="slide">Transition: Slide</option>
            <option value="zoom">Transition: Scale Zoom</option>
          </select>

          <button
            type="button"
            onClick={() => handleAspectRatioChange(deck.aspectRatio === '4:3' ? '16:9' : '4:3')}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs text-slate-700 font-mono"
            title="Toggle aspect ratio (16:9 Widescreen vs 4:3 Standard)"
          >
            <Monitor className="w-3.5 h-3.5 text-slate-500" />
            <span>{deck.aspectRatio || '16:9'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDuplicateSlide(currentSlideIndex)}
            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
            title="Duplicate current slide"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            disabled={deck.slides.length <= 1}
            onClick={() => handleDeleteSlide(currentSlideIndex)}
            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 disabled:opacity-40"
            title="Delete current slide"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      {sorterView ? (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-100">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Slide Sorter ({deck.slides.length} Slides)</h2>
                <p className="text-xs text-slate-500">
                  Click any slide to edit, or reorder and duplicate slides across the deck.
                </p>
              </div>
              <Button size="sm" onClick={() => setSorterView(false)}>
                Return to Editor
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {deck.slides.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSlideIndex(idx);
                    setSorterView(false);
                  }}
                  className={cn(
                    'group cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between aspect-[16/10]',
                    idx === currentSlideIndex ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        Slide {idx + 1}
                      </span>
                      <span className="uppercase tracking-wider">
                        {LAYOUT_DESCRIPTIONS[s.layout]?.label ?? s.layout}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{s.title || 'Untitled Slide'}</h3>
                    {s.subtitle && <p className="text-xs text-slate-500 line-clamp-2">{s.subtitle}</p>}
                  </div>
                  <div
                    className="flex items-center justify-between pt-2 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, idx - 1)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                        title="Move earlier"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === deck.slides.length - 1}
                        onClick={() => handleMoveSlide(idx, idx + 1)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                        title="Move later"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateSlide(idx)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deck.slides.length <= 1}
                        onClick={() => handleDeleteSlide(idx)}
                        className="p-1 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 disabled:opacity-30"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Rail: Slide Thumbnails (Desktop only) */}
          <div className="hidden md:flex shrink-0 h-full">
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
          </div>

          {/* Center: Slide WYSIWYG Editing Canvas */}
          <main className={cn('flex-1 flex flex-col min-w-0 h-full overflow-hidden', currentTheme.canvasBg)}>
            <div className="flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 md:p-8">
              <SlidesCanvas
                slide={currentSlide}
                theme={deck.theme}
                aspectRatio={deck.aspectRatio}
                slideNumber={currentSlideIndex + 1}
                totalSlides={deck.slides.length}
                onUpdateSlide={handleUpdateCurrentSlide}
              />
            </div>

            {/* Collapsible Speaker Notes Drawer */}
            {notesOpen && (
              <div className="border-t border-slate-200 bg-white p-3 shrink-0 transition-all">
                <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span>Speaker Notes (Slide {currentSlideIndex + 1})</span>
                  <span className="text-[10px] lowercase opacity-70">Visible only in Presenter View</span>
                </div>
                <textarea
                  rows={3}
                  value={currentSlide.speakerNotes ?? ''}
                  onChange={(e) => handleUpdateCurrentSlide({ ...currentSlide, speakerNotes: e.target.value })}
                  placeholder="Type talking points, cues, or key statistics to mention..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            )}

            {/* Mobile Slide Navigation Strip */}
            <div className="md:hidden shrink-0 border-t border-slate-200 bg-white px-3 py-2 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentSlideIndex <= 0}
                  onClick={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                  title="Previous slide"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-700 min-w-16 text-center">
                  Slide {currentSlideIndex + 1} of {deck.slides.length}
                </span>
                <button
                  type="button"
                  disabled={currentSlideIndex >= deck.slides.length - 1}
                  onClick={() => setCurrentSlideIndex((i) => Math.min(deck.slides.length - 1, i + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30"
                  title="Next slide"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSorterView(true)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Sorter</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSlide('title-content')}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      )}

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
