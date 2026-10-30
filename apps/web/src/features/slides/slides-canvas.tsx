import React, { useRef } from 'react';
import type {
  SlideCanvasElement,
  SlideIconName,
  SlideItem,
  SlideTheme,
} from './slides-types';
import {
  DEFAULT_CHART_DATA,
  DEFAULT_METRICS_LIST,
  DEFAULT_TABLE_DATA,
  DEFAULT_THREE_CARDS,
  DEFAULT_TIMELINE_STEPS,
  SLIDE_THEMES,
} from './slides-types';
import { cn } from '@/lib/utils';
import {
  Award,
  BarChart3,
  Bookmark,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Compass,
  FileText,
  Globe,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

export interface SlidesCanvasProps {
  slide: SlideItem;
  theme: SlideTheme;
  aspectRatio?: '16:9' | '4:3';
  slideNumber: number;
  totalSlides: number;
  readOnly?: boolean;
  onUpdateSlide?(updated: SlideItem): void;
}

export function SlideBadgeIcon({ name, className }: { name?: SlideIconName; className?: string }) {
  switch (name) {
    case 'briefcase':
      return <Briefcase className={className} />;
    case 'trending-up':
      return <TrendingUp className={className} />;
    case 'shield-check':
      return <ShieldCheck className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'bar-chart':
      return <BarChart3 className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'check-circle':
      return <CheckCircle2 className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'bookmark':
      return <Bookmark className={className} />;
    default:
      return null;
  }
}

const FONT_CLASS_MAP = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  display: 'font-sans tracking-tight',
} as const;

const TITLE_SIZE_MAP = {
  sm: 'text-2xl md:text-3xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-4xl md:text-6xl',
} as const;

const BODY_SIZE_MAP = {
  sm: 'text-sm md:text-base',
  md: 'text-base md:text-lg',
  lg: 'text-lg md:text-xl',
  xl: 'text-xl md:text-2xl',
} as const;

const IMAGE_ROUNDED_MAP = {
  none: 'rounded-none',
  md: 'rounded-lg',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const;

export function SlidesCanvas({
  slide,
  theme,
  aspectRatio = '16:9',
  slideNumber,
  totalSlides,
  readOnly = false,
  onUpdateSlide,
}: SlidesCanvasProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const themeConfig = SLIDE_THEMES[theme] || SLIDE_THEMES['clean-corporate'];
  const customStyle = slide.style ?? {};
  const fontClass = customStyle.fontFamily ? FONT_CLASS_MAP[customStyle.fontFamily] : themeConfig.fontFamily;
  const alignClass =
    customStyle.textAlign === 'center'
      ? 'text-center items-center'
      : customStyle.textAlign === 'right'
        ? 'text-right items-end'
        : 'text-left items-start';
  const showFooter = customStyle.showFooter !== false;
  const imgPos = customStyle.imagePosition ?? 'right';
  const imgFit = customStyle.imageFit ?? 'cover';
  const imgRounded = IMAGE_ROUNDED_MAP[customStyle.imageRounded ?? '2xl'];
  const imgShadow = customStyle.imageShadow !== false;

  const handleChange = (patch: Partial<SlideItem>) => {
    if (readOnly || !onUpdateSlide) return;
    onUpdateSlide({ ...slide, ...patch });
  };

  const handleStyleChange = (stylePatch: Partial<NonNullable<SlideItem['style']>>) => {
    if (readOnly || !onUpdateSlide) return;
    onUpdateSlide({
      ...slide,
      style: {
        ...(slide.style ?? {}),
        ...stylePatch,
      },
    });
  };

  const handleBulletChange = (idx: number, val: string) => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = [...(slide.bullets ?? [])];
    bullets[idx] = val;
    handleChange({ bullets });
  };

  const handleAddBullet = () => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = [...(slide.bullets ?? []), 'New key takeaway point'];
    handleChange({ bullets });
  };

  const handleRemoveBullet = (idx: number) => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = (slide.bullets ?? []).filter((_, i) => i !== idx);
    handleChange({ bullets });
  };

  // Floating elements handlers
  const handleUpdateElement = (id: string, patch: Partial<SlideCanvasElement>) => {
    if (readOnly || !onUpdateSlide) return;
    const elements = (slide.elements ?? []).map((el) => (el.id === id ? { ...el, ...patch } : el));
    handleChange({ elements });
  };

  const handleRemoveElement = (id: string) => {
    if (readOnly || !onUpdateSlide) return;
    const elements = (slide.elements ?? []).filter((el) => el.id !== id);
    handleChange({ elements });
  };

  const handleDragElementStart = (e: React.MouseEvent, el: SlideCanvasElement) => {
    if (readOnly || !onUpdateSlide || !cardRef.current) return;
    e.preventDefault();
    const rect = cardRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;

    const onMove = (moveEvent: MouseEvent) => {
      const dxPct = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - startY) / rect.height) * 100;
      const nextX = Math.max(4, Math.min(86, Math.round(origX + dxPct)));
      const nextY = Math.max(6, Math.min(86, Math.round(origY + dyPct)));
      handleUpdateElement(el.id, { x: nextX, y: nextY });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const customCardStyle: React.CSSProperties = {
    ...(customStyle.backgroundColor ? { background: customStyle.backgroundColor } : {}),
    ...(customStyle.textColor ? { color: customStyle.textColor } : {}),
  };

  const customAccentStyle: React.CSSProperties | undefined = customStyle.accentColor
    ? { color: customStyle.accentColor }
    : undefined;

  const customAccentBgStyle: React.CSSProperties | undefined = customStyle.accentColor
    ? { backgroundColor: customStyle.accentColor }
    : undefined;

  const renderBadge = (defaultLabel?: string) => {
    const badgeText = customStyle.badgeText ?? defaultLabel;
    const iconName = customStyle.iconName;
    if (!badgeText && (!iconName || iconName === 'none') && readOnly) return null;

    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-2xs',
          themeConfig.badgeBg
        )}
        style={
          customStyle.accentColor
            ? {
                borderColor: `${customStyle.accentColor}33`,
                backgroundColor: `${customStyle.accentColor}12`,
                color: customStyle.accentColor,
              }
            : undefined
        }
      >
        {iconName && iconName !== 'none' && <SlideBadgeIcon name={iconName} className="size-3.5 shrink-0" />}
        {readOnly ? (
          <span>{badgeText}</span>
        ) : (
          <input
            type="text"
            value={badgeText ?? ''}
            onChange={(e) => handleStyleChange({ badgeText: e.target.value })}
            placeholder="BADGE LABEL"
            className="bg-transparent border-0 outline-none focus:ring-0 uppercase tracking-wider font-bold text-[11px] w-36"
          />
        )}
      </div>
    );
  };

  const renderImageFrame = (heightClass = 'h-60', maxHClass = 'max-h-64') => {
    if (!slide.imageUrl) return null;
    return (
      <div
        className={cn(
          'relative group overflow-hidden border border-slate-200/90 w-full bg-slate-50',
          maxHClass,
          imgRounded,
          imgShadow && 'shadow-lg'
        )}
      >
        <img
          src={slide.imageUrl}
          alt={slide.imageAlt ?? slide.title}
          className={cn(
            'w-full transition-transform duration-500 group-hover:scale-[1.02]',
            heightClass,
            imgRounded,
            imgFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover'
          )}
          loading="lazy"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => handleChange({ imageUrl: undefined })}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/90 text-slate-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-600"
            title="Remove image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const threeCards = slide.cards && slide.cards.length > 0 ? slide.cards : DEFAULT_THREE_CARDS;
  const timelineSteps = slide.steps && slide.steps.length > 0 ? slide.steps : DEFAULT_TIMELINE_STEPS;
  const metricsList = slide.metricsList && slide.metricsList.length > 0 ? slide.metricsList : DEFAULT_METRICS_LIST;
  const tableData = slide.tableData ?? DEFAULT_TABLE_DATA;
  const chartData = slide.chartData ?? DEFAULT_CHART_DATA;
  const maxChartVal = Math.max(...chartData.values, 1);

  return (
    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 select-text">
      {/* Slide Card */}
      <div
        ref={cardRef}
        style={customCardStyle}
        className={cn(
          'relative w-full max-w-[1080px] rounded-2xl p-8 md:p-14 flex flex-col justify-between transition-all duration-300 border overflow-hidden',
          aspectRatio === '4:3' ? 'aspect-[4/3] max-w-[920px]' : 'aspect-[16/9]',
          themeConfig.cardBg,
          fontClass
        )}
      >
        {/* Top Accent Bar */}
        <div
          className={cn('absolute top-0 left-0 right-0 h-1.5', themeConfig.accentBg)}
          style={customAccentBgStyle}
        />

        {/* Background Image Mode */}
        {slide.imageUrl && imgPos === 'background' && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={slide.imageUrl}
              alt={slide.imageAlt ?? slide.title}
              className="w-full h-full object-cover opacity-15"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/75 to-white/60" />
          </div>
        )}

        {/* Main Slide Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center w-full min-h-0">
          {/* 1. TITLE SLIDE LAYOUT */}
          {slide.layout === 'title' && (
            <div
              className={cn(
                'grid gap-8 items-center my-auto w-full',
                slide.imageUrl && imgPos !== 'background' ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1'
              )}
            >
              <div
                className={cn(
                  slide.imageUrl && imgPos !== 'background' ? 'md:col-span-7' : 'w-full',
                  'flex flex-col space-y-4',
                  alignClass
                )}
              >
                {renderBadge('KEYNOTE PRESENTATION')}

                {readOnly ? (
                  <h1
                    className={cn(
                      TITLE_SIZE_MAP[customStyle.titleSize ?? 'xl'],
                      'tracking-tight leading-[1.12]',
                      themeConfig.titleColor
                    )}
                    style={customStyle.textColor ? { color: customStyle.textColor } : undefined}
                  >
                    {slide.title}
                  </h1>
                ) : (
                  <textarea
                    rows={2}
                    value={slide.title}
                    onChange={(e) => handleChange({ title: e.target.value })}
                    placeholder="Presentation Title..."
                    className={cn(
                      'w-full bg-transparent resize-none border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none tracking-tight leading-[1.12]',
                      TITLE_SIZE_MAP[customStyle.titleSize ?? 'xl'],
                      customStyle.textAlign === 'center'
                        ? 'text-center'
                        : customStyle.textAlign === 'right'
                          ? 'text-right'
                          : 'text-left',
                      themeConfig.titleColor
                    )}
                    style={customStyle.textColor ? { color: customStyle.textColor } : undefined}
                  />
                )}

                {readOnly ? (
                  <p
                    className={cn(
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'],
                      'font-medium leading-relaxed opacity-90',
                      themeConfig.textColor
                    )}
                  >
                    {slide.subtitle}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={slide.subtitle ?? ''}
                    onChange={(e) => handleChange({ subtitle: e.target.value })}
                    placeholder="Click to add subtitle, presenter name, or organization..."
                    className={cn(
                      'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none font-medium leading-relaxed',
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'],
                      customStyle.textAlign === 'center'
                        ? 'text-center'
                        : customStyle.textAlign === 'right'
                          ? 'text-right'
                          : 'text-left',
                      themeConfig.textColor
                    )}
                  />
                )}
              </div>

              {slide.imageUrl && imgPos !== 'background' && (
                <div className="md:col-span-5 flex justify-center items-center">
                  {renderImageFrame('h-64', 'max-h-72')}
                </div>
              )}
            </div>
          )}

          {/* 2. SECTION HEADER LAYOUT */}
          {slide.layout === 'section' && (
            <div className={cn('my-auto flex flex-col space-y-4 w-full', alignClass)}>
              {renderBadge('SECTION')}
              {readOnly ? (
                <h1
                  className={cn(
                    TITLE_SIZE_MAP[customStyle.titleSize ?? 'xl'],
                    'tracking-tight leading-tight',
                    themeConfig.titleColor
                  )}
                >
                  {slide.title}
                </h1>
              ) : (
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => handleChange({ title: e.target.value })}
                  placeholder="Section Title..."
                  className={cn(
                    'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none tracking-tight',
                    TITLE_SIZE_MAP[customStyle.titleSize ?? 'xl'],
                    customStyle.textAlign === 'center'
                      ? 'text-center'
                      : customStyle.textAlign === 'right'
                        ? 'text-right'
                        : 'text-left',
                    themeConfig.titleColor
                  )}
                />
              )}
              {readOnly ? (
                <p className={cn(BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'], 'max-w-2xl opacity-85', themeConfig.textColor)}>
                  {slide.subtitle}
                </p>
              ) : (
                <input
                  type="text"
                  value={slide.subtitle ?? ''}
                  onChange={(e) => handleChange({ subtitle: e.target.value })}
                  placeholder="Section overview or topic summary..."
                  className={cn(
                    'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none opacity-85',
                    BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'],
                    customStyle.textAlign === 'center'
                      ? 'text-center'
                      : customStyle.textAlign === 'right'
                        ? 'text-right'
                        : 'text-left',
                    themeConfig.textColor
                  )}
                />
              )}
            </div>
          )}

          {/* SHARED HEADER FOR CONTENT SLIDES */}
          {slide.layout !== 'title' && slide.layout !== 'section' && (
            <div className={cn('flex flex-col space-y-2 mb-5 w-full', alignClass)}>
              {(customStyle.badgeText || (customStyle.iconName && customStyle.iconName !== 'none')) && renderBadge()}
              {readOnly ? (
                <h2
                  className={cn(
                    TITLE_SIZE_MAP[customStyle.titleSize ?? 'lg'],
                    'tracking-tight leading-tight',
                    themeConfig.titleColor
                  )}
                >
                  {slide.title}
                </h2>
              ) : (
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => handleChange({ title: e.target.value })}
                  placeholder="Slide Heading..."
                  className={cn(
                    'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none tracking-tight',
                    TITLE_SIZE_MAP[customStyle.titleSize ?? 'lg'],
                    customStyle.textAlign === 'center'
                      ? 'text-center'
                      : customStyle.textAlign === 'right'
                        ? 'text-right'
                        : 'text-left',
                    themeConfig.titleColor
                  )}
                />
              )}
            </div>
          )}

          {/* 3. TITLE & CONTENT LAYOUT */}
          {slide.layout === 'title-content' && (
            <div
              className={cn(
                'grid gap-8 my-auto items-center w-full',
                slide.imageUrl && imgPos !== 'background'
                  ? imgPos === 'top'
                    ? 'grid-cols-1'
                    : 'grid-cols-1 md:grid-cols-12'
                  : 'grid-cols-1'
              )}
            >
              {slide.imageUrl && imgPos === 'left' && (
                <div className="md:col-span-5 flex justify-center items-center">{renderImageFrame()}</div>
              )}

              {slide.imageUrl && imgPos === 'top' && (
                <div className="w-full flex justify-center">{renderImageFrame('h-36', 'max-h-40')}</div>
              )}

              <div
                className={cn(
                  slide.imageUrl && (imgPos === 'right' || imgPos === 'left') ? 'md:col-span-7' : 'w-full',
                  'space-y-3.5'
                )}
              >
                <ul className="space-y-3.5">
                  {(slide.bullets ?? []).map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3.5 group">
                      <span
                        className={cn(
                          'mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs',
                          themeConfig.accentBg
                        )}
                        style={customAccentBgStyle}
                      >
                        {idx + 1}
                      </span>
                      {readOnly ? (
                        <span
                          className={cn(
                            BODY_SIZE_MAP[customStyle.bodySize ?? 'md'],
                            'leading-relaxed flex-1 font-medium',
                            themeConfig.textColor
                          )}
                        >
                          {bullet}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => handleBulletChange(idx, e.target.value)}
                          className={cn(
                            'flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none leading-relaxed font-medium',
                            BODY_SIZE_MAP[customStyle.bodySize ?? 'md'],
                            themeConfig.textColor
                          )}
                        />
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBullet(idx)}
                          className="opacity-0 group-hover:opacity-80 hover:opacity-100 p-1 text-rose-500 transition-opacity"
                          title="Delete bullet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleAddBullet}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 hover:bg-white shadow-2xs transition-all mt-2',
                      themeConfig.accentColor
                    )}
                    style={customAccentStyle}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add point</span>
                  </button>
                )}
              </div>

              {slide.imageUrl && imgPos === 'right' && (
                <div className="md:col-span-5 flex justify-center items-center">{renderImageFrame()}</div>
              )}
            </div>
          )}

          {/* 4. TWO-COLUMN LAYOUT */}
          {slide.layout === 'two-column' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto w-full">
              <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-2xs space-y-2">
                {readOnly ? (
                  <div
                    className={cn(
                      'whitespace-pre-line leading-relaxed font-medium',
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'sm'],
                      themeConfig.textColor
                    )}
                  >
                    {slide.columnLeft}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={slide.columnLeft ?? ''}
                    onChange={(e) => handleChange({ columnLeft: e.target.value })}
                    placeholder="Left column content (comparison, current state, key points)..."
                    className={cn(
                      'w-full h-full bg-transparent resize-none focus:outline-none leading-relaxed font-medium',
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'sm'],
                      themeConfig.textColor
                    )}
                  />
                )}
              </div>
              <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-200/70 shadow-2xs space-y-2">
                {readOnly ? (
                  <div
                    className={cn(
                      'whitespace-pre-line leading-relaxed font-medium',
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'sm'],
                      themeConfig.textColor
                    )}
                  >
                    {slide.columnRight}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={slide.columnRight ?? ''}
                    onChange={(e) => handleChange({ columnRight: e.target.value })}
                    placeholder="Right column content (advantages, outcomes, future state)..."
                    className={cn(
                      'w-full h-full bg-transparent resize-none focus:outline-none leading-relaxed font-medium',
                      BODY_SIZE_MAP[customStyle.bodySize ?? 'sm'],
                      themeConfig.textColor
                    )}
                  />
                )}
              </div>
            </div>
          )}

          {/* 5. THREE-COLUMN PILLARS LAYOUT */}
          {slide.layout === 'three-column' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-auto w-full">
              {threeCards.map((card, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div
                      className={cn(
                        'inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white',
                        themeConfig.accentBg
                      )}
                      style={customAccentBgStyle}
                    >
                      0{idx + 1}
                    </div>
                    {readOnly ? (
                      <h3 className={cn('text-base md:text-lg font-bold', themeConfig.titleColor)}>{card.title}</h3>
                    ) : (
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => {
                          const next = threeCards.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c));
                          handleChange({ cards: next });
                        }}
                        className={cn(
                          'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-base md:text-lg font-bold',
                          themeConfig.titleColor
                        )}
                      />
                    )}
                    {readOnly ? (
                      <p className={cn('text-xs md:text-sm leading-relaxed', themeConfig.textColor)}>{card.body}</p>
                    ) : (
                      <textarea
                        rows={4}
                        value={card.body}
                        onChange={(e) => {
                          const next = threeCards.map((c, i) => (i === idx ? { ...c, body: e.target.value } : c));
                          handleChange({ cards: next });
                        }}
                        className={cn(
                          'w-full bg-transparent resize-none focus:outline-none text-xs md:text-sm leading-relaxed',
                          themeConfig.textColor
                        )}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 6. TIMELINE / PROCESS DIAGRAM LAYOUT */}
          {slide.layout === 'timeline' && (
            <div className="my-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {timelineSteps.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      {readOnly ? (
                        <span
                          className={cn(
                            'text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full',
                            themeConfig.badgeBg
                          )}
                        >
                          {item.step}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={item.step}
                          onChange={(e) => {
                            const next = timelineSteps.map((s, i) => (i === idx ? { ...s, step: e.target.value } : s));
                            handleChange({ steps: next });
                          }}
                          className={cn(
                            'w-24 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                            themeConfig.badgeBg
                          )}
                        />
                      )}
                      <span className="text-xs font-mono text-slate-300 font-bold">0{idx + 1}</span>
                    </div>
                    {readOnly ? (
                      <h4 className={cn('text-sm md:text-base font-bold pt-1', themeConfig.titleColor)}>
                        {item.title}
                      </h4>
                    ) : (
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const next = timelineSteps.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s));
                          handleChange({ steps: next });
                        }}
                        className={cn(
                          'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-sm md:text-base font-bold pt-1',
                          themeConfig.titleColor
                        )}
                      />
                    )}
                    {readOnly ? (
                      <p className={cn('text-xs leading-relaxed', themeConfig.textColor)}>{item.description}</p>
                    ) : (
                      <textarea
                        rows={3}
                        value={item.description}
                        onChange={(e) => {
                          const next = timelineSteps.map((s, i) =>
                            i === idx ? { ...s, description: e.target.value } : s
                          );
                          handleChange({ steps: next });
                        }}
                        className={cn(
                          'w-full bg-transparent resize-none focus:outline-none text-xs leading-relaxed',
                          themeConfig.textColor
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. KPI DASHBOARD GRID (3 METRICS) */}
          {slide.layout === 'metrics-grid' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto w-full">
              {metricsList.map((m, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3"
                >
                  {readOnly ? (
                    <div
                      className={cn('text-4xl md:text-5xl font-black tracking-tight', themeConfig.accentColor)}
                      style={customAccentStyle}
                    >
                      {m.value}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={m.value}
                      onChange={(e) => {
                        const next = metricsList.map((item, i) =>
                          i === idx ? { ...item, value: e.target.value } : item
                        );
                        handleChange({ metricsList: next });
                      }}
                      className={cn(
                        'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-4xl md:text-5xl font-black tracking-tight',
                        themeConfig.accentColor
                      )}
                      style={customAccentStyle}
                    />
                  )}
                  {readOnly ? (
                    <p className={cn('text-sm font-semibold leading-snug', themeConfig.titleColor)}>{m.label}</p>
                  ) : (
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => {
                        const next = metricsList.map((item, i) =>
                          i === idx ? { ...item, label: e.target.value } : item
                        );
                        handleChange({ metricsList: next });
                      }}
                      className={cn(
                        'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-sm font-semibold',
                        themeConfig.titleColor
                      )}
                    />
                  )}
                  {(m.delta || !readOnly) && (
                    <div>
                      {readOnly ? (
                        <span className="inline-block text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {m.delta}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={m.delta ?? ''}
                          onChange={(e) => {
                            const next = metricsList.map((item, i) =>
                              i === idx ? { ...item, delta: e.target.value } : item
                            );
                            handleChange({ metricsList: next });
                          }}
                          placeholder="+Delta / YoY"
                          className="w-32 text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 8. DATA & COMPARISON TABLE SLIDE */}
          {slide.layout === 'comparison-table' && (
            <div className="my-auto w-full overflow-x-auto">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className={cn('text-white', themeConfig.accentBg)} style={customAccentBgStyle}>
                      {tableData.headers.map((hdr, cIdx) => (
                        <th key={cIdx} className="py-2.5 px-3.5 font-bold border-r border-white/15 last:border-r-0">
                          {readOnly ? (
                            <span>{hdr}</span>
                          ) : (
                            <input
                              type="text"
                              value={hdr}
                              onChange={(e) => {
                                const headers = [...tableData.headers];
                                headers[cIdx] = e.target.value;
                                handleChange({ tableData: { ...tableData, headers } });
                              }}
                              className="w-full bg-transparent text-white placeholder:text-white/70 font-bold focus:outline-none"
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tableData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={cn(
                              'py-2.5 px-3.5 border-r border-slate-100 last:border-r-0',
                              cIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'
                            )}
                          >
                            {readOnly ? (
                              <span>{cell}</span>
                            ) : (
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => {
                                  const rows = tableData.rows.map((r, ri) =>
                                    ri === rIdx ? r.map((c, ci) => (ci === cIdx ? e.target.value : c)) : [...r]
                                  );
                                  handleChange({ tableData: { ...tableData, rows } });
                                }}
                                className="w-full bg-transparent focus:outline-none focus:border-b focus:border-blue-500"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newRow = tableData.headers.map((_, i) => (i === 0 ? 'New Criterion' : 'Detail'));
                      handleChange({ tableData: { ...tableData, rows: [...tableData.rows, newRow] } });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                  {tableData.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleChange({
                          tableData: { ...tableData, rows: tableData.rows.slice(0, -1) },
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600"
                    >
                      Remove Last Row
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 9. VISUAL DATA CHART SLIDE */}
          {slide.layout === 'chart-slide' && (
            <div className="my-auto w-full flex flex-col gap-4">
              {!readOnly && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Chart Style:</span>
                    {(['bar', 'horizontal-bar'] as const).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => handleChange({ chartData: { ...chartData, chartType: ct } })}
                        className={cn(
                          'px-2 py-0.5 rounded font-medium capitalize',
                          chartData.chartType === ct
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        {ct === 'bar' ? 'Vertical Columns' : 'Horizontal Bars'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Unit suffix:</span>
                    <input
                      type="text"
                      value={chartData.unit ?? ''}
                      onChange={(e) => handleChange({ chartData: { ...chartData, unit: e.target.value } })}
                      placeholder="e.g. M, %, K"
                      className="w-14 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-xs text-center"
                    />
                  </div>
                </div>
              )}

              {chartData.chartType === 'horizontal-bar' ? (
                <div className="space-y-3 bg-white/95 border border-slate-200 rounded-2xl p-5 shadow-2xs">
                  {chartData.labels.map((lbl, idx) => {
                    const val = chartData.values[idx] ?? 0;
                    const pct = Math.max(8, Math.round((val / maxChartVal) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          {readOnly ? (
                            <span className="text-slate-700">{lbl}</span>
                          ) : (
                            <input
                              type="text"
                              value={lbl}
                              onChange={(e) => {
                                const labels = [...chartData.labels];
                                labels[idx] = e.target.value;
                                handleChange({ chartData: { ...chartData, labels } });
                              }}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-slate-800 font-semibold"
                            />
                          )}
                          {readOnly ? (
                            <span className={cn('font-mono font-bold', themeConfig.accentColor)} style={customAccentStyle}>
                              {val}
                              {chartData.unit ?? ''}
                            </span>
                          ) : (
                            <input
                              type="number"
                              value={val}
                              onChange={(e) => {
                                const values = [...chartData.values];
                                values[idx] = Number(e.target.value) || 0;
                                handleChange({ chartData: { ...chartData, values } });
                              }}
                              className="w-20 text-right font-mono font-bold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                            />
                          )}
                        </div>
                        <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', themeConfig.accentBg)}
                            style={{ width: `${pct}%`, ...customAccentBgStyle }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-6 items-end h-52 bg-white/95 border border-slate-200 rounded-2xl p-6 shadow-2xs">
                  {chartData.labels.map((lbl, idx) => {
                    const val = chartData.values[idx] ?? 0;
                    const pct = Math.max(12, Math.round((val / maxChartVal) * 100));
                    return (
                      <div key={idx} className="flex flex-col items-center h-full justify-end gap-2">
                        {readOnly ? (
                          <span className={cn('text-sm font-mono font-bold', themeConfig.accentColor)} style={customAccentStyle}>
                            {val}
                            {chartData.unit ?? ''}
                          </span>
                        ) : (
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const values = [...chartData.values];
                              values[idx] = Number(e.target.value) || 0;
                              handleChange({ chartData: { ...chartData, values } });
                            }}
                            className="w-16 text-center text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded py-0.5"
                          />
                        )}
                        <div className="w-full max-w-[68px] bg-slate-100 rounded-t-xl flex items-end h-32 overflow-hidden">
                          <div
                            className={cn('w-full rounded-t-xl transition-all duration-500', themeConfig.accentBg)}
                            style={{ height: `${pct}%`, ...customAccentBgStyle }}
                          />
                        </div>
                        {readOnly ? (
                          <span className="text-xs font-bold text-slate-700">{lbl}</span>
                        ) : (
                          <input
                            type="text"
                            value={lbl}
                            onChange={(e) => {
                              const labels = [...chartData.labels];
                              labels[idx] = e.target.value;
                              handleChange({ chartData: { ...chartData, labels } });
                            }}
                            className="w-full text-center text-xs font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 10. BIG METRIC KPI LAYOUT */}
          {slide.layout === 'big-metric' && (
            <div className="my-auto py-6 text-center space-y-3 w-full">
              {readOnly ? (
                <div
                  className={cn('text-6xl md:text-8xl font-black tracking-tight', themeConfig.accentColor)}
                  style={customAccentStyle}
                >
                  {slide.metric?.value ?? '100%'}
                </div>
              ) : (
                <input
                  type="text"
                  value={slide.metric?.value ?? '100%'}
                  onChange={(e) => handleChange({ metric: { value: e.target.value, label: slide.metric?.label ?? '' } })}
                  placeholder="Metric value (e.g. 99.9%, 4.8x)..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-6xl md:text-8xl font-black tracking-tight',
                    themeConfig.accentColor
                  )}
                  style={customAccentStyle}
                />
              )}
              {readOnly ? (
                <div
                  className={cn(
                    BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'],
                    'font-medium max-w-2xl mx-auto',
                    themeConfig.textColor
                  )}
                >
                  {slide.metric?.label ?? 'Metric description'}
                </div>
              ) : (
                <input
                  type="text"
                  value={slide.metric?.label ?? ''}
                  onChange={(e) => handleChange({ metric: { value: slide.metric?.value ?? '', label: e.target.value } })}
                  placeholder="Metric description and strategic impact..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none font-medium max-w-2xl mx-auto',
                    BODY_SIZE_MAP[customStyle.bodySize ?? 'lg'],
                    themeConfig.textColor
                  )}
                />
              )}
            </div>
          )}

          {/* 11. QUOTE LAYOUT */}
          {slide.layout === 'quote' && (
            <div className="my-auto py-4 px-6 max-w-3xl mx-auto text-center space-y-4 w-full">
              {readOnly ? (
                <p className={cn('text-xl md:text-3xl italic leading-relaxed font-serif', themeConfig.titleColor)}>
                  “{slide.quote?.text ?? 'Quote text here'}”
                </p>
              ) : (
                <textarea
                  rows={3}
                  value={slide.quote?.text ?? ''}
                  onChange={(e) => handleChange({ quote: { text: e.target.value, author: slide.quote?.author ?? '' } })}
                  placeholder="Enter memorable executive or scripture quote..."
                  className={cn(
                    'w-full text-center bg-transparent resize-none border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-xl md:text-3xl italic leading-relaxed font-serif',
                    themeConfig.titleColor
                  )}
                />
              )}
              {readOnly ? (
                <p
                  className={cn('text-sm md:text-base font-bold tracking-wider uppercase', themeConfig.accentColor)}
                  style={customAccentStyle}
                >
                  — {slide.quote?.author ?? 'Author'}
                </p>
              ) : (
                <input
                  type="text"
                  value={slide.quote?.author ?? ''}
                  onChange={(e) => handleChange({ quote: { text: slide.quote?.text ?? '', author: e.target.value } })}
                  placeholder="Author or citation..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-sm md:text-base font-bold tracking-wider uppercase',
                    themeConfig.accentColor
                  )}
                  style={customAccentStyle}
                />
              )}
            </div>
          )}

          {/* 12. BLANK / VISUAL CANVAS LAYOUT */}
          {slide.layout === 'blank' && (
            <div className="my-auto flex flex-col items-center justify-center gap-4 w-full">
              {slide.imageUrl && imgPos !== 'background' ? (
                <div className="w-full max-w-2xl">{renderImageFrame('h-64', 'max-h-72')}</div>
              ) : (
                !readOnly &&
                (!slide.elements || slide.elements.length === 0) && (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <ImageIcon className="size-8 stroke-1" />
                    <span className="text-xs">
                      Use the toolbar above to insert an image, shape, text box, or switch layout
                    </span>
                  </div>
                )
              )}
              {(slide.subtitle || !readOnly) && (
                <input
                  type="text"
                  readOnly={readOnly}
                  value={slide.subtitle ?? ''}
                  onChange={(e) => handleChange({ subtitle: e.target.value })}
                  placeholder={readOnly ? '' : 'Add caption or supporting note...'}
                  className={cn(
                    'w-full max-w-xl text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-sm md:text-base',
                    themeConfig.textColor
                  )}
                />
              )}
            </div>
          )}
        </div>

        {/* Floating Canvas Shapes / Text Boxes / Callouts */}
        {(slide.elements ?? []).map((el) => (
          <div
            key={el.id}
            style={{ left: `${el.x}%`, top: `${el.y}%` }}
            className={cn(
              'absolute z-20 group flex items-center gap-1 transition-shadow',
              el.type === 'pill-badge' &&
                'rounded-full bg-blue-600 text-white px-3.5 py-1 text-xs font-bold shadow-md',
              el.type === 'callout' &&
                'rounded-xl bg-amber-50 border border-amber-300 text-amber-950 px-3.5 py-2 text-xs font-medium shadow-md max-w-xs',
              el.type === 'rectangle' &&
                'rounded-xl bg-white/95 border-2 border-blue-600 text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-md max-w-xs',
              el.type === 'text-box' &&
                'rounded-lg bg-white/90 border border-slate-200 text-slate-800 px-3 py-1.5 text-sm font-medium shadow-xs max-w-sm',
              el.type === 'divider' && 'w-48 h-1 bg-blue-600 rounded-full'
            )}
          >
            {!readOnly && (
              <button
                type="button"
                onMouseDown={(e) => handleDragElementStart(e, el)}
                className="cursor-move opacity-40 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded"
                title="Drag to reposition"
              >
                <GripVertical className="w-3 h-3" />
              </button>
            )}
            {el.type !== 'divider' &&
              (readOnly ? (
                <span>{el.text}</span>
              ) : (
                <input
                  type="text"
                  value={el.text}
                  onChange={(e) => handleUpdateElement(el.id, { text: e.target.value })}
                  className="bg-transparent focus:outline-none min-w-[90px]"
                />
              ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemoveElement(el.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded"
                title="Remove element"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {/* Slide Footer with Page Number */}
        {showFooter && (
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-200/70">
            <span className="truncate max-w-[260px] font-medium">{slide.title || 'Presentation'}</span>
            <span className="font-mono font-semibold">
              {slideNumber} / {totalSlides}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
