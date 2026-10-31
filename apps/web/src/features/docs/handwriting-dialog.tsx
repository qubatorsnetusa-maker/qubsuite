import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HandwritingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: Editor | null;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

const COLORS = [
  { name: 'Black', value: '#0f172a' },
  { name: 'Ink Blue', value: '#1d4ed8' },
  { name: 'Red', value: '#b91c1c' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Purple', value: '#6d28d9' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 7 },
];

export function HandwritingDialog({
  open,
  onOpenChange,
  editor,
}: HandwritingDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState(COLORS[1]?.value || '#1d4ed8'); // Ink blue default
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]?.value || 4);
  const [paperStyle, setPaperStyle] = useState<'ruled' | 'grid' | 'blank'>('ruled');

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);

  // Redraw canvas whenever strokes or paperStyle changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (paperStyle === 'ruled') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const lineGap = 28;
      for (let y = lineGap; y < height; y += lineGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // Red margin line
      ctx.strokeStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(36, height);
      ctx.stroke();
    } else if (paperStyle === 'grid') {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      const gridGap = 20;
      for (let x = gridGap; x < width; x += gridGap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = gridGap; y < height; y += gridGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw all strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      const first = stroke.points[0];
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        if (pt) {
          ctx.lineTo(pt.x, pt.y);
        }
      }

      ctx.strokeStyle = stroke.isEraser ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }, [strokes, paperStyle]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width || 600;
          canvas.height = rect.height || 360;
          redraw();
        }
      }, 50);
    }
  }, [open, redraw]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasCoords(e);
    currentPointsRef.current = [pt];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getCanvasCoords(e);
    currentPointsRef.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = currentPointsRef.current;
    if (points.length >= 2) {
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : selectedColor;
        ctx.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentPointsRef.current.length > 0) {
      const newStroke: Stroke = {
        points: [...currentPointsRef.current],
        color: selectedColor,
        width: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
        isEraser: tool === 'eraser',
      };
      setStrokes((prev) => [...prev, newStroke]);
      setRedoStrokes([]);
      currentPointsRef.current = [];
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    if (last) {
      setStrokes((prev) => prev.slice(0, prev.length - 1));
      setRedoStrokes((prev) => [...prev, last]);
    }
  };

  const handleRedo = () => {
    if (redoStrokes.length === 0) return;
    const next = redoStrokes[redoStrokes.length - 1];
    if (next) {
      setRedoStrokes((prev) => prev.slice(0, prev.length - 1));
      setStrokes((prev) => [...prev, next]);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setRedoStrokes([]);
    redraw();
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas || !editor) return;
    if (strokes.length === 0) {
      toast.info('Canvas is empty. Draw or write something first.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'image',
        attrs: {
          src: dataUrl,
          alt: 'Handwritten note',
          layout: 'wrap-left',
          width: '50%',
        },
      })
      .run();

    toast.success('Inserted handwriting into document');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Handwriting & Ink Sketch"
        description="Draw, write, or sign using your finger, stylus, or cursor."
        className="max-w-3xl p-4 sm:p-6 select-none"
      >
        {/* Drawing Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
          {/* Tool switch */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-800">
            <Button
              variant={tool === 'pen' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTool('pen')}
              className={`h-7 px-2.5 text-xs gap-1 ${
                tool === 'pen' ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-300' : ''
              }`}
            >
              <PenTool className="size-3.5" />
              <span>Pen</span>
            </Button>
            <Button
              variant={tool === 'eraser' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTool('eraser')}
              className={`h-7 px-2.5 text-xs gap-1 ${
                tool === 'eraser' ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-300' : ''
              }`}
            >
              <Eraser className="size-3.5" />
              <span>Eraser</span>
            </Button>
          </div>

          {/* Color palette */}
          {tool === 'pen' && (
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2 dark:border-slate-800">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  className={`size-5 rounded-full transition-transform ${
                    selectedColor === c.value ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* Stroke width */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-800">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.label}
                type="button"
                onClick={() => setStrokeWidth(w.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  strokeWidth === w.value
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Paper Background style */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPaperStyle('ruled')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                paperStyle === 'ruled' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ruled
            </button>
            <button
              type="button"
              onClick={() => setPaperStyle('grid')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                paperStyle === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setPaperStyle('blank')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                paperStyle === 'blank' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Blank
            </button>
          </div>

          {/* Undo / Redo / Clear */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="size-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40"
              title="Undo stroke"
            >
              <Undo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStrokes.length === 0}
              className="size-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40"
              title="Redo stroke"
            >
              <Redo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="size-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200"
              title="Clear canvas"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 shadow-inner bg-white dark:border-slate-800">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-[320px] sm:h-[380px] touch-none cursor-crosshair"
          />
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleInsert}
            disabled={strokes.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Insert into Document</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
