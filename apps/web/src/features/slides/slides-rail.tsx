import React from 'react';
import type { SlideItem, SlideLayout, SlideTheme } from './slides-types';
import { LAYOUT_DESCRIPTIONS, SLIDE_THEMES } from './slides-types';
import { cn } from '@/lib/utils';
import {
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layout,
  Type,
  List,
  Columns,
  Hash,
  Quote,
  Square,
  LayoutGrid,
  GitCommit,
  Table,
  BarChart3,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';

export interface SlidesRailProps {
  slides: SlideItem[];
  theme: SlideTheme;
  currentIndex: number;
  onSelectSlide(index: number): void;
  onAddSlide(layout: SlideLayout): void;
  onDuplicateSlide(index: number): void;
  onDeleteSlide(index: number): void;
  onMoveSlide(fromIndex: number, toIndex: number): void;
}

const LAYOUT_ICONS: Record<SlideLayout, React.ReactNode> = {
  title: <Type className="w-4 h-4" />,
  'title-content': <List className="w-4 h-4" />,
  'two-column': <Columns className="w-4 h-4" />,
  'three-column': <LayoutGrid className="w-4 h-4" />,
  timeline: <GitCommit className="w-4 h-4" />,
  'metrics-grid': <Hash className="w-4 h-4" />,
  'comparison-table': <Table className="w-4 h-4" />,
  'chart-slide': <BarChart3 className="w-4 h-4" />,
  section: <Layout className="w-4 h-4" />,
  'big-metric': <Hash className="w-4 h-4" />,
  quote: <Quote className="w-4 h-4" />,
  blank: <Square className="w-4 h-4" />,
};

export function SlidesRail({
  slides,
  theme,
  currentIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}: SlidesRailProps) {
  const themeConfig = SLIDE_THEMES[theme] || SLIDE_THEMES['clean-corporate'];

  return (
    <div className="w-56 shrink-0 h-full border-r border-slate-200 bg-white flex flex-col justify-between overflow-hidden">
      {/* Top Header & Add Slide Button */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Slides ({slides.length})
        </span>

        {/* Layout Picker for New Slide */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs"
              title="Add slide with layout"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {(Object.keys(LAYOUT_DESCRIPTIONS) as SlideLayout[]).map((layout) => (
              <DropdownMenuItem
                key={layout}
                icon={LAYOUT_ICONS[layout]}
                onSelect={() => onAddSlide(layout)}
              >
                <div>
                  <div className="font-medium text-xs">{LAYOUT_DESCRIPTIONS[layout].label}</div>
                  <div className="text-[10px] text-muted">{LAYOUT_DESCRIPTIONS[layout].description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Slide Thumbnails Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {slides.map((slide, idx) => {
          const isSelected = idx === currentIndex;
          return (
            <div
              key={slide.id}
              className={cn(
                'group relative rounded-xl border transition-all p-2 cursor-pointer flex flex-col gap-1.5',
                isSelected
                  ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/15'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/70'
              )}
              onClick={() => onSelectSlide(idx)}
            >
              {/* Header info */}
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span className="tabular-nums font-semibold text-slate-700">{idx + 1}</span>
                <span className="text-[10px] uppercase opacity-75">{slide.layout}</span>
              </div>

              {/* Mini Slide Card Preview */}
              <div
                style={slide.style?.backgroundColor ? { background: slide.style.backgroundColor } : undefined}
                className={cn(
                  'w-full aspect-[16/9] rounded-md border flex flex-col justify-between p-2 overflow-hidden shadow-2xs text-[9px] pointer-events-none select-none relative',
                  themeConfig.cardBg
                )}
              >
                <div
                  className={cn('absolute top-0 left-0 right-0 h-0.5', themeConfig.accentBg)}
                  style={slide.style?.accentColor ? { backgroundColor: slide.style.accentColor } : undefined}
                />
                <div className={cn('truncate font-bold tracking-tight', themeConfig.titleColor)}>
                  {slide.title || 'Untitled'}
                </div>
                <div className={cn('text-[7px] opacity-75 truncate', themeConfig.textColor)}>
                  {slide.subtitle || (slide.bullets ? `${slide.bullets.length} points` : '')}
                </div>
              </div>

              {/* Hover Quick Action Buttons */}
              <div
                className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 pt-1 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  disabled={idx === 0}
                  onClick={() => onMoveSlide(idx, idx - 1)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 text-muted"
                  title="Move slide up"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  disabled={idx === slides.length - 1}
                  onClick={() => onMoveSlide(idx, idx + 1)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 text-muted"
                  title="Move slide down"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onDuplicateSlide(idx)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted"
                  title="Duplicate slide"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  disabled={slides.length <= 1}
                  onClick={() => onDeleteSlide(idx)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-500 disabled:opacity-20"
                  title="Delete slide"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
