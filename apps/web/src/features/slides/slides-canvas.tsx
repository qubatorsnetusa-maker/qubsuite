import React from 'react';
import type { SlideItem, SlideTheme } from './slides-types';
import { SLIDE_THEMES } from './slides-types';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

export interface SlidesCanvasProps {
  slide: SlideItem;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  readOnly?: boolean;
  onUpdateSlide?(updated: SlideItem): void;
}

export function SlidesCanvas({
  slide,
  theme,
  slideNumber,
  totalSlides,
  readOnly = false,
  onUpdateSlide,
}: SlidesCanvasProps) {
  const themeConfig = SLIDE_THEMES[theme] || SLIDE_THEMES['dark-modern'];

  const handleChange = (patch: Partial<SlideItem>) => {
    if (readOnly || !onUpdateSlide) return;
    onUpdateSlide({ ...slide, ...patch });
  };

  const handleBulletChange = (idx: number, val: string) => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = [...(slide.bullets ?? [])];
    bullets[idx] = val;
    handleChange({ bullets });
  };

  const handleAddBullet = () => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = [...(slide.bullets ?? []), 'New bullet point item'];
    handleChange({ bullets });
  };

  const handleRemoveBullet = (idx: number) => {
    if (readOnly || !onUpdateSlide) return;
    const bullets = (slide.bullets ?? []).filter((_, i) => i !== idx);
    handleChange({ bullets });
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 select-text">
      {/* 16:9 Aspect Ratio Slide Card */}
      <div
        className={cn(
          'relative w-full max-w-[1080px] aspect-[16/9] rounded-2xl p-8 md:p-14 flex flex-col justify-between transition-all duration-300 border overflow-hidden',
          themeConfig.cardBg,
          themeConfig.fontFamily
        )}
      >
        {/* Top/Header Content depending on Layout */}
        <div className="w-full">
          {slide.layout === 'title' ? (
            <div className="my-auto pt-10 md:pt-16 text-center space-y-4">
              {readOnly ? (
                <h1 className={cn('text-4xl md:text-6xl tracking-tight leading-tight', themeConfig.titleColor)}>
                  {slide.title}
                </h1>
              ) : (
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => handleChange({ title: e.target.value })}
                  placeholder="Slide Title..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-4xl md:text-6xl tracking-tight font-bold',
                    themeConfig.titleColor
                  )}
                />
              )}

              {readOnly ? (
                <p className={cn('text-lg md:text-2xl', themeConfig.accentColor)}>
                  {slide.subtitle}
                </p>
              ) : (
                <input
                  type="text"
                  value={slide.subtitle ?? ''}
                  onChange={(e) => handleChange({ subtitle: e.target.value })}
                  placeholder="Click to add subtitle or presenter name..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-lg md:text-2xl font-medium',
                    themeConfig.accentColor
                  )}
                />
              )}
            </div>
          ) : slide.layout === 'section' ? (
            <div className="my-auto pt-16 text-center space-y-4">
              <span className={cn('text-xs font-bold tracking-widest uppercase opacity-75', themeConfig.accentColor)}>
                SECTION
              </span>
              {readOnly ? (
                <h1 className={cn('text-4xl md:text-6xl tracking-tight leading-tight', themeConfig.titleColor)}>
                  {slide.title}
                </h1>
              ) : (
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => handleChange({ title: e.target.value })}
                  placeholder="Section Title..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-4xl md:text-6xl tracking-tight font-bold',
                    themeConfig.titleColor
                  )}
                />
              )}
              {readOnly ? (
                <p className={cn('text-base md:text-xl opacity-80', themeConfig.textColor)}>
                  {slide.subtitle}
                </p>
              ) : (
                <input
                  type="text"
                  value={slide.subtitle ?? ''}
                  onChange={(e) => handleChange({ subtitle: e.target.value })}
                  placeholder="Topic summary..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-base md:text-xl opacity-80',
                    themeConfig.textColor
                  )}
                />
              )}
            </div>
          ) : (
            <div className="space-y-1 mb-6">
              {readOnly ? (
                <h2 className={cn('text-2xl md:text-4xl tracking-tight leading-tight', themeConfig.titleColor)}>
                  {slide.title}
                </h2>
              ) : (
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => handleChange({ title: e.target.value })}
                  placeholder="Slide Title..."
                  className={cn(
                    'w-full bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-2xl md:text-4xl tracking-tight font-bold',
                    themeConfig.titleColor
                  )}
                />
              )}
            </div>
          )}

          {/* Middle Body Content based on Layout */}
          {slide.layout === 'title-content' && (
            <div className={cn('grid gap-8 my-auto items-center', slide.imageUrl ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1')}>
              <div className={cn(slide.imageUrl ? 'md:col-span-7' : 'w-full', 'space-y-3 pl-2')}>
                <ul className="space-y-3">
                  {(slide.bullets ?? []).map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3 group">
                      <span className={cn('mt-2 w-2 h-2 rounded-full shrink-0', themeConfig.accentColor.replace('text-', 'bg-'))} />
                      {readOnly ? (
                        <span className={cn('text-base md:text-xl leading-relaxed flex-1', themeConfig.textColor)}>
                          {bullet}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => handleBulletChange(idx, e.target.value)}
                          className={cn(
                            'flex-1 bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-base md:text-xl leading-relaxed',
                            themeConfig.textColor
                          )}
                        />
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => handleRemoveBullet(idx)}
                          className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 text-red-400 transition-opacity"
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
                    onClick={handleAddBullet}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md opacity-70 hover:opacity-100 bg-white/5 hover:bg-white/10 transition-all mt-4',
                      themeConfig.accentColor
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add bullet point</span>
                  </button>
                )}
              </div>

              {slide.imageUrl && (
                <div className="md:col-span-5 flex justify-center items-center">
                  <div className="relative group overflow-hidden rounded-xl border border-current/15 shadow-xl max-h-60 w-full">
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageAlt ?? slide.title}
                      className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {!readOnly && (
                      <button
                        onClick={() => handleChange({ imageUrl: undefined })}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {slide.layout === 'two-column' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-4">
              <div className="p-4 rounded-xl bg-black/10 border border-current/10 space-y-2">
                {readOnly ? (
                  <div className={cn('whitespace-pre-line text-sm md:text-base leading-relaxed', themeConfig.textColor)}>
                    {slide.columnLeft}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={slide.columnLeft ?? ''}
                    onChange={(e) => handleChange({ columnLeft: e.target.value })}
                    placeholder="Left column content (bullet points, comparison)..."
                    className={cn(
                      'w-full h-full bg-transparent resize-none focus:outline-none text-sm md:text-base leading-relaxed',
                      themeConfig.textColor
                    )}
                  />
                )}
              </div>
              <div className="p-4 rounded-xl bg-black/10 border border-current/10 space-y-2">
                {readOnly ? (
                  <div className={cn('whitespace-pre-line text-sm md:text-base leading-relaxed', themeConfig.textColor)}>
                    {slide.columnRight}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={slide.columnRight ?? ''}
                    onChange={(e) => handleChange({ columnRight: e.target.value })}
                    placeholder="Right column content (features, advantages)..."
                    className={cn(
                      'w-full h-full bg-transparent resize-none focus:outline-none text-sm md:text-base leading-relaxed',
                      themeConfig.textColor
                    )}
                  />
                )}
              </div>
            </div>
          )}

          {slide.layout === 'big-metric' && (
            <div className="my-auto py-8 text-center space-y-3">
              {readOnly ? (
                <div className={cn('text-6xl md:text-8xl font-black tracking-tight', themeConfig.accentColor)}>
                  {slide.metric?.value ?? '100%'}
                </div>
              ) : (
                <input
                  type="text"
                  value={slide.metric?.value ?? '100%'}
                  onChange={(e) => handleChange({ metric: { value: e.target.value, label: slide.metric?.label ?? '' } })}
                  placeholder="Metric value (e.g. 99.9%, $5M)..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-6xl md:text-8xl font-black tracking-tight',
                    themeConfig.accentColor
                  )}
                />
              )}
              {readOnly ? (
                <div className={cn('text-lg md:text-2xl font-medium max-w-xl mx-auto', themeConfig.textColor)}>
                  {slide.metric?.label ?? 'Metric description'}
                </div>
              ) : (
                <input
                  type="text"
                  value={slide.metric?.label ?? ''}
                  onChange={(e) => handleChange({ metric: { value: slide.metric?.value ?? '', label: e.target.value } })}
                  placeholder="Metric description and context..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-lg md:text-2xl font-medium max-w-xl mx-auto',
                    themeConfig.textColor
                  )}
                />
              )}
            </div>
          )}

          {slide.layout === 'quote' && (
            <div className="my-auto py-6 px-6 max-w-3xl mx-auto text-center space-y-4">
              <span className="text-4xl md:text-6xl font-serif opacity-30 select-none">“</span>
              {readOnly ? (
                <p className={cn('text-xl md:text-3xl italic leading-relaxed font-serif', themeConfig.titleColor)}>
                  {slide.quote?.text ?? 'Quote text here'}
                </p>
              ) : (
                <textarea
                  rows={3}
                  value={slide.quote?.text ?? ''}
                  onChange={(e) => handleChange({ quote: { text: e.target.value, author: slide.quote?.author ?? '' } })}
                  placeholder="Enter memorable quote..."
                  className={cn(
                    'w-full text-center bg-transparent resize-none border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-xl md:text-3xl italic leading-relaxed font-serif',
                    themeConfig.titleColor
                  )}
                />
              )}
              {readOnly ? (
                <p className={cn('text-sm md:text-base font-semibold tracking-wide uppercase', themeConfig.accentColor)}>
                  — {slide.quote?.author ?? 'Author'}
                </p>
              ) : (
                <input
                  type="text"
                  value={slide.quote?.author ?? ''}
                  onChange={(e) => handleChange({ quote: { text: slide.quote?.text ?? '', author: e.target.value } })}
                  placeholder="Author name..."
                  className={cn(
                    'w-full text-center bg-transparent border-b border-transparent hover:border-current/20 focus:border-blue-500 focus:outline-none text-sm md:text-base font-semibold tracking-wide uppercase',
                    themeConfig.accentColor
                  )}
                />
              )}
            </div>
          )}

          {slide.layout === 'blank' && (
            <div className="my-auto py-12 text-center opacity-40 italic">
              Blank Slide Canvas
            </div>
          )}
        </div>

        {/* Slide Footer with Page Number */}
        <div className="flex items-center justify-between text-xs opacity-50 pt-4 border-t border-current/10">
          <span className="truncate max-w-[200px]">{slide.title || 'Slide'}</span>
          <span>
            {slideNumber} / {totalSlides}
          </span>
        </div>
      </div>
    </div>
  );
}
