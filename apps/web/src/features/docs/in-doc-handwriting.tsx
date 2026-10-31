import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkStroke {
  id: string;
  points: InkPoint[];
  color: string;
  width: number;
}

interface DirectInkProps {
  editor?: Editor | null;
  documentId: string;
  active: boolean;
  onClose: () => void;
  pageWidth: number;
  pageHeight: number;
}

const INK_COLORS = [
  { name: 'Ink Blue', value: '#1d4ed8' },
  { name: 'Midnight Black', value: '#0f172a' },
  { name: 'Ruby Red', value: '#dc2626' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Purple', value: '#7c3aed' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2.5 },
  { label: 'Medium', value: 4.5 },
  { label: 'Bold', value: 7.5 },
];

function getStorageKey(documentId: string) {
  return `qub_page_ink_v2_${documentId}`;
}

function getStrokeBounds(strokes: InkStroke[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX - 12, minY: minY - 12, maxX: maxX + 12, maxY: maxY + 12 };
}

function distToPoint(a: InkPoint, b: InkPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Direct Note Canvas Handwriting Layer
 * Allows the user to write directly on the document page canvas (no box) so ink co-exists with normal text.
 * Supports vector stroke erasing, undo/redo, clear, and long-press free dragging of handwritten notes.
 */
export function InDocHandwriting({
  documentId,
  active,
  onClose,
  pageWidth,
  pageHeight,
}: DirectInkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>(INK_COLORS[0]!.value);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1]!.value);

  const [strokes, setStrokes] = useState<InkStroke[]>(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(documentId));
      return saved ? (JSON.parse(saved) as InkStroke[]) : [];
    } catch {
      return [];
    }
  });
  const [redoStack, setRedoStack] = useState<InkStroke[][]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const [draggingSelection, setDraggingSelection] = useState(false);

  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<InkPoint[]>([]);
  const dragLastPtRef = useRef<InkPoint | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist strokes per document
  useEffect(() => {
    try {
      if (strokes.length === 0) {
        localStorage.removeItem(getStorageKey(documentId));
      } else {
        localStorage.setItem(getStorageKey(documentId), JSON.stringify(strokes));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [strokes, documentId]);

  // Convert viewport clientX/clientY to unscaled page canvas coordinates
  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): InkPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    []
  );

  // Render all vector strokes onto the transparent page canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (pts: InkPoint[], color: string, width: number, highlight = false) => {
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (highlight) {
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      if (pts.length === 1) {
        ctx.fillStyle = color;
        ctx.arc(pts[0]!.x, pts[0]!.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i]!.x + pts[i + 1]!.x) / 2;
          const midY = (pts[i]!.y + pts[i + 1]!.y) / 2;
          ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, midX, midY);
        }
        const last = pts[pts.length - 1]!;
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    for (const s of strokes) {
      drawStroke(s.points, s.color, s.width, selectedStrokeIds.has(s.id));
    }

    if (isDrawingRef.current && tool === 'pen' && currentPointsRef.current.length > 0) {
      drawStroke(currentPointsRef.current, selectedColor, strokeWidth);
    }

    // Draw dashed selection outline if strokes are selected for moving
    if (selectedStrokeIds.size > 0) {
      const selStrokes = strokes.filter((s) => selectedStrokeIds.has(s.id));
      const b = getStrokeBounds(selStrokes);
      if (b) {
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
        ctx.restore();
      }
    }
  }, [strokes, selectedColor, strokeWidth, tool, selectedStrokeIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = pageWidth || 816;
    canvas.height = Math.max(pageHeight || 1056, canvas.parentElement?.scrollHeight || 1056);
    redraw();
  }, [pageWidth, pageHeight, redraw]);

  // Erase any stroke within radius of point
  const eraseNearPoint = useCallback((pt: InkPoint) => {
    const eraseRadius = 18;
    setStrokes((prev) => {
      const remaining = prev.filter(
        (stroke) => !stroke.points.some((p) => distToPoint(p, pt) <= eraseRadius)
      );
      return remaining.length === prev.length ? prev : remaining;
    });
  }, []);

  // Find connected cluster of strokes near a point (for long-press free move)
  const findClusterNearPoint = useCallback(
    (pt: InkPoint): Set<string> => {
      const hitRadius = 24;
      const seed = strokes.find((s) => s.points.some((p) => distToPoint(p, pt) <= hitRadius));
      if (!seed) return new Set();
      // Group nearby strokes within 90px so an entire handwritten word/sketch moves together
      const cluster = new Set<string>([seed.id]);
      let added = true;
      while (added) {
        added = false;
        const currentStrokes = strokes.filter((s) => cluster.has(s.id));
        const b = getStrokeBounds(currentStrokes);
        if (!b) break;
        for (const s of strokes) {
          if (cluster.has(s.id)) continue;
          const near = s.points.some(
            (p) =>
              p.x >= b.minX - 75 &&
              p.x <= b.maxX + 75 &&
              p.y >= b.minY - 55 &&
              p.y <= b.maxY + 55
          );
          if (near) {
            cluster.add(s.id);
            added = true;
          }
        }
      }
      return cluster;
    },
    [strokes]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active && selectedStrokeIds.size === 0) return;
    e.stopPropagation();
    const pt = toCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    // Check if pointer is inside currently selected handwriting cluster to drag it
    if (selectedStrokeIds.size > 0) {
      const selStrokes = strokes.filter((s) => selectedStrokeIds.has(s.id));
      const b = getStrokeBounds(selStrokes);
      if (b && pt.x >= b.minX && pt.x <= b.maxX && pt.y >= b.minY && pt.y <= b.maxY) {
        setDraggingSelection(true);
        dragLastPtRef.current = pt;
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      } else {
        setSelectedStrokeIds(new Set());
      }
    }

    if (!active) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'eraser') {
      isDrawingRef.current = true;
      eraseNearPoint(pt);
      return;
    }

    // Start long-press timer: if user holds finger still on existing ink for 320ms, grab it to move freely
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const hitCluster = findClusterNearPoint(pt);
    if (hitCluster.size > 0) {
      longPressTimerRef.current = setTimeout(() => {
        if (currentPointsRef.current.length <= 4) {
          isDrawingRef.current = false;
          currentPointsRef.current = [];
          setSelectedStrokeIds(hitCluster);
          setDraggingSelection(true);
          dragLastPtRef.current = pt;
          try {
            navigator.vibrate?.(30);
          } catch {}
          redraw();
        }
      }, 320);
    }

    isDrawingRef.current = true;
    currentPointsRef.current = [pt];
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (draggingSelection && selectedStrokeIds.size > 0 && dragLastPtRef.current) {
      e.stopPropagation();
      const dx = pt.x - dragLastPtRef.current.x;
      const dy = pt.y - dragLastPtRef.current.y;
      dragLastPtRef.current = pt;
      setStrokes((prev) =>
        prev.map((s) =>
          selectedStrokeIds.has(s.id)
            ? { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : s
        )
      );
      return;
    }

    if (!isDrawingRef.current) return;
    e.stopPropagation();

    if (tool === 'eraser') {
      eraseNearPoint(pt);
      return;
    }

    // Cancel long-press if user is actively drawing a stroke
    if (
      currentPointsRef.current.length > 0 &&
      distToPoint(currentPointsRef.current[0]!, pt) > 12 &&
      longPressTimerRef.current
    ) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    currentPointsRef.current.push(pt);
    redraw();
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (draggingSelection) {
      setDraggingSelection(false);
      dragLastPtRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === 'pen' && currentPointsRef.current.length > 0) {
      const newStroke: InkStroke = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        points: [...currentPointsRef.current],
        color: selectedColor,
        width: strokeWidth,
      };
      setStrokes((prev) => [...prev, newStroke]);
      setRedoStack([]);
      currentPointsRef.current = [];
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const prev = strokes.slice(0, -1);
    setRedoStack((r) => [...r, strokes]);
    setStrokes(prev);
    setSelectedStrokeIds(new Set());
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setRedoStack((r) => r.slice(0, -1));
    setStrokes(next);
  };

  const handleClearAll = () => {
    if (strokes.length === 0) return;
    setRedoStack((r) => [...r, strokes]);
    setStrokes([]);
    setSelectedStrokeIds(new Set());
    toast.success('Cleared handwriting from page');
  };

  const handleDeleteSelected = () => {
    if (selectedStrokeIds.size === 0) return;
    setRedoStack((r) => [...r, strokes]);
    setStrokes((prev) => prev.filter((s) => !selectedStrokeIds.has(s.id)));
    setSelectedStrokeIds(new Set());
  };

  const selectionBounds =
    selectedStrokeIds.size > 0
      ? getStrokeBounds(strokes.filter((s) => selectedStrokeIds.has(s.id)))
      : null;

  return (
    <>
      {/* Floating Pen Controls Bar (Rendered fixed at top of workspace so it is never scaled/tiny on mobile) */}
      {active && (
        <div
          className="fixed top-28 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1rem)] items-center gap-1.5 overflow-x-auto no-scrollbar rounded-full border border-blue-200 bg-white/98 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md select-none print:hidden animate-in fade-in slide-in-from-top-2"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Pen / Eraser Toggle */}
          <button
            type="button"
            onClick={() => {
              setTool('pen');
              setSelectedStrokeIds(new Set());
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors shrink-0',
              tool === 'pen' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <PenTool className="size-3.5" />
            <span>Pen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTool('eraser');
              setSelectedStrokeIds(new Set());
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors shrink-0',
              tool === 'eraser' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <Eraser className="size-3.5" />
            <span>Eraser</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

          {/* Ink Colors */}
          <div className="flex items-center gap-1 shrink-0">
            {INK_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setSelectedColor(c.value);
                  setTool('pen');
                }}
                style={{ backgroundColor: c.value }}
                className={cn(
                  'size-5 rounded-full border transition-transform shrink-0',
                  selectedColor === c.value && tool === 'pen'
                    ? 'scale-125 ring-2 ring-blue-500 ring-offset-1 border-white'
                    : 'border-slate-300 opacity-85 hover:opacity-100'
                )}
                title={c.name}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

          {/* Stroke Widths */}
          <div className="flex items-center gap-0.5 shrink-0">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.label}
                type="button"
                onClick={() => {
                  setStrokeWidth(w.value);
                  setTool('pen');
                }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                  strokeWidth === w.value && tool === 'pen'
                    ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

          {/* Undo / Redo / Clear */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="size-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 shrink-0"
            title="Undo stroke"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="size-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 shrink-0"
            title="Redo stroke"
          >
            <Redo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={strokes.length === 0}
            className="size-7 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30 shrink-0"
            title="Clear all handwriting"
          >
            <Trash2 className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedStrokeIds(new Set());
              onClose();
            }}
            className="ml-1 flex items-center gap-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-semibold shadow-xs shrink-0"
          >
            <Check className="size-3.5 stroke-[2.5]" />
            <span>Done</span>
          </button>
        </div>
      )}

      {/* Transparent Full-Page Note Ink Canvas (No Box!) */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          'absolute inset-0 z-20 w-full h-full bg-transparent',
          active || selectedStrokeIds.size > 0
            ? 'pointer-events-auto touch-none cursor-crosshair'
            : 'pointer-events-none'
        )}
      />

      {/* Delete badge on selected handwriting cluster */}
      {selectionBounds && (
        <button
          type="button"
          onClick={handleDeleteSelected}
          style={{
            left: `${Math.min(pageWidth - 36, Math.max(8, selectionBounds.maxX - 14))}px`,
            top: `${Math.max(8, selectionBounds.minY - 14)}px`,
          }}
          className="absolute z-30 flex size-7 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 active:scale-95 print:hidden"
          title="Delete selected handwriting"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </>
  );
}
