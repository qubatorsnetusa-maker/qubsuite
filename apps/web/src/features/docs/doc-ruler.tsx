import { useState, useRef, useMemo } from 'react';

interface HorizontalRulerProps {
  width: number; // total page width in pixels
  leftMargin: number; // in pixels
  rightMargin: number; // in pixels
  onChangeMargins?: (left: number, right: number) => void;
}

export function HorizontalRuler({
  width,
  leftMargin,
  rightMargin,
  onChangeMargins,
}: HorizontalRulerProps) {
  const pixelsPerInch = 96;
  const inches = Math.ceil(width / pixelsPerInch);
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [guidePos, setGuidePos] = useState<number | null>(null);

  const handlePointerDown = (type: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(width, e.clientX - rect.left));

    if (dragging === 'left') {
      const minMargin = 24; // 0.25 inch
      const maxLeft = width - rightMargin - 96; // keep at least 1 inch space
      const newLeft = Math.round(Math.max(minMargin, Math.min(maxLeft, x)));
      setGuidePos(newLeft);
      onChangeMargins?.(newLeft, rightMargin);
    } else {
      const minMargin = 24;
      const maxRight = width - leftMargin - 96;
      const newRight = Math.round(Math.max(minMargin, Math.min(maxRight, width - x)));
      setGuidePos(width - newRight);
      onChangeMargins?.(leftMargin, newRight);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      setDragging(null);
      setGuidePos(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const ticks = useMemo(() => {
    const list: { pos: number; type: 'inch' | 'half' | 'quarter' | 'eighth'; label?: number }[] = [];
    for (let inch = 0; inch <= inches; inch++) {
      const inchPos = inch * pixelsPerInch;
      if (inchPos <= width) {
        list.push({ pos: inchPos, type: 'inch', label: inch });
      }
      for (let eighth = 1; eighth < 8; eighth++) {
        const pos = inchPos + (eighth * pixelsPerInch) / 8;
        if (pos > width) break;
        let type: 'half' | 'quarter' | 'eighth' = 'eighth';
        if (eighth === 4) type = 'half';
        else if (eighth === 2 || eighth === 6) type = 'quarter';
        list.push({ pos, type });
      }
    }
    return list;
  }, [width, inches]);

  return (
    <div className="relative mx-auto" style={{ width: `${width}px` }}>
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-6 select-none border-b border-l border-r border-slate-300 bg-[#f1f3f4] text-[9px] font-medium text-slate-500 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      >
        {/* Left Shaded Margin Zone */}
        <div
          style={{ width: `${leftMargin}px` }}
          className="absolute top-0 bottom-0 left-0 bg-slate-300/60 dark:bg-slate-900/60 transition-all duration-75"
        />

        {/* Right Shaded Margin Zone */}
        <div
          style={{ width: `${rightMargin}px` }}
          className="absolute top-0 bottom-0 right-0 bg-slate-300/60 dark:bg-slate-900/60 transition-all duration-75"
        />

        {/* Ruler Ticks & Number Labels */}
        {ticks.map((t, idx) => {
          let height = 'h-1.5';
          if (t.type === 'inch') height = 'h-3';
          else if (t.type === 'half') height = 'h-2';
          else if (t.type === 'quarter') height = 'h-1.5';
          else height = 'h-1';

          return (
            <div
              key={idx}
              style={{ left: `${t.pos}px` }}
              className={`absolute bottom-0 w-px bg-slate-400 dark:bg-slate-500 ${height}`}
            >
              {t.label !== undefined && t.label > 0 && t.pos < width - 12 && (
                <span className="absolute -top-3.5 -translate-x-1/2 font-sans font-semibold text-slate-600 dark:text-slate-300">
                  {t.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Interactive Left Margin Handle (Downwards Triangle & Bar) */}
        <div
          style={{ left: `${leftMargin}px` }}
          onPointerDown={(e) => handlePointerDown('left', e)}
          className="group absolute top-0 -translate-x-1/2 z-20 flex cursor-ew-resize flex-col items-center"
          title={`Left margin: ${(leftMargin / 96).toFixed(2)} in (Drag to adjust)`}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-blue-600 drop-shadow-xs group-hover:scale-125 transition-transform" />
          <div className="w-[3px] h-3 bg-blue-600 rounded-xs" />
        </div>

        {/* Interactive Right Margin Handle (Upwards/Downwards Triangle) */}
        <div
          style={{ left: `${width - rightMargin}px` }}
          onPointerDown={(e) => handlePointerDown('right', e)}
          className="group absolute top-0 -translate-x-1/2 z-20 flex cursor-ew-resize flex-col items-center"
          title={`Right margin: ${(rightMargin / 96).toFixed(2)} in (Drag to adjust)`}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-blue-600 drop-shadow-xs group-hover:scale-125 transition-transform" />
          <div className="w-[3px] h-3 bg-blue-600 rounded-xs" />
        </div>
      </div>

      {/* Vertical Alignment Guide Line while dragging */}
      {dragging && guidePos !== null && (
        <div
          style={{ left: `${guidePos}px` }}
          className="pointer-events-none absolute top-6 h-[800px] w-px border-l-2 border-dashed border-blue-500 z-50 shadow-md"
        />
      )}
    </div>
  );
}
