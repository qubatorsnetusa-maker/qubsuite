import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignLeft,
  AlignRight,
  AlignCenter,
  Baseline,
  Minus,
  Plus,
  Trash2,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

interface ImageControlsBarProps {
  editor: Editor;
}

export function ImageControlsBar({ editor }: ImageControlsBarProps) {
  const isImageActive = useEditorState({
    editor,
    selector: (ctx) => ctx.editor.isActive('image'),
  });

  if (!isImageActive) return null;

  const attrs = editor.getAttributes('image');
  const currentLayout = attrs.layout || 'wrap-left';
  const currentWidth = attrs.width ? String(attrs.width) : '50%';
  const hasOffset = Boolean(attrs.offsetX || attrs.offsetY);

  const setLayout = (layout: 'wrap-left' | 'wrap-right' | 'break' | 'inline') => {
    editor.chain().focus().updateAttributes('image', { layout, offsetX: 0, offsetY: 0 }).run();
  };

  const setWidth = (width: string) => {
    editor.chain().focus().updateAttributes('image', { width }).run();
  };

  const stepWidth = (delta: number) => {
    const raw = parseInt(currentWidth, 10);
    const base = Number.isNaN(raw) ? 50 : raw;
    const next = Math.min(100, Math.max(15, base + delta));
    setWidth(`${next}%`);
  };

  const resetPosition = () => {
    editor.chain().focus().updateAttributes('image', { offsetX: 0, offsetY: 0 }).run();
  };

  const deleteImage = () => {
    editor.chain().focus().deleteSelection().run();
  };

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-blue-200 bg-white/98 px-3 py-1 text-xs shadow-lg backdrop-blur-md my-1 select-none animate-in fade-in"
      role="toolbar"
      aria-label="Image formatting controls"
    >
      <div className="flex items-center gap-1 pr-1.5 border-r border-slate-200 text-slate-500 font-semibold shrink-0">
        <ImageIcon className="size-3.5 text-blue-600" />
        <span className="text-[11px] hidden sm:inline">Wrap:</span>
      </div>

      {/* Text Wrap Modes */}
      <Tooltip content="Wrap Text Left (text flows around right)">
        <Button
          variant={currentLayout === 'wrap-left' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 text-xs gap-1 shrink-0',
            currentLayout === 'wrap-left' && 'bg-blue-50 text-blue-700 font-bold'
          )}
          onClick={() => setLayout('wrap-left')}
        >
          <AlignLeft className="size-3.5 text-blue-600" />
          <span>Wrap Left</span>
        </Button>
      </Tooltip>

      <Tooltip content="Wrap Text Right (text flows around left)">
        <Button
          variant={currentLayout === 'wrap-right' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 text-xs gap-1 shrink-0',
            currentLayout === 'wrap-right' && 'bg-blue-50 text-blue-700 font-bold'
          )}
          onClick={() => setLayout('wrap-right')}
        >
          <AlignRight className="size-3.5 text-blue-600" />
          <span>Wrap Right</span>
        </Button>
      </Tooltip>

      <Tooltip content="Inline (flows with text)">
        <Button
          variant={currentLayout === 'inline' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 text-xs gap-1 shrink-0',
            currentLayout === 'inline' && 'bg-blue-50 text-blue-700 font-bold'
          )}
          onClick={() => setLayout('inline')}
        >
          <Baseline className="size-3.5" />
          <span>Inline</span>
        </Button>
      </Tooltip>

      <Tooltip content="Break Text (centered block)">
        <Button
          variant={currentLayout === 'break' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 text-xs gap-1 shrink-0',
            currentLayout === 'break' && 'bg-blue-50 text-blue-700 font-bold'
          )}
          onClick={() => setLayout('break')}
        >
          <AlignCenter className="size-3.5" />
          <span>Break</span>
        </Button>
      </Tooltip>

      <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

      {/* Resize presets */}
      <div className="flex items-center gap-0.5 shrink-0">
        {(['25%', '50%', '75%', '100%'] as const).map((preset) => (
          <Tooltip key={preset} content={`Set width to ${preset}`}>
            <button
              type="button"
              onClick={() => setWidth(preset)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors',
                currentWidth === preset
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {preset}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1 shrink-0">
        <Tooltip content="Decrease size">
          <button
            type="button"
            onClick={() => stepWidth(-10)}
            className="size-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95"
          >
            <Minus className="size-3" />
          </button>
        </Tooltip>
        <Tooltip content="Increase size">
          <button
            type="button"
            onClick={() => stepWidth(10)}
            className="size-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95"
          >
            <Plus className="size-3" />
          </button>
        </Tooltip>
      </div>

      {hasOffset && (
        <>
          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />
          <Tooltip content="Reset free position">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-slate-600 hover:bg-slate-100 shrink-0"
              onClick={resetPosition}
            >
              <RotateCcw className="size-3" />
              <span>Snap</span>
            </Button>
          </Tooltip>
        </>
      )}

      <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

      {/* Delete Image */}
      <Tooltip content="Delete image">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
          onClick={deleteImage}
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
        </Button>
      </Tooltip>
    </div>
  );
}
