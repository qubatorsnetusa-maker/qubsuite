import { useMemo } from 'react';

interface VerticalRulerProps {
  height?: number; // total page height in pixels
  topMargin?: number;
  bottomMargin?: number;
}

export function VerticalRuler({
  height = 1056,
  topMargin = 96,
  bottomMargin = 96,
}: VerticalRulerProps) {
  const pixelsPerInch = 96;
  const inches = Math.ceil(height / pixelsPerInch);

  const ticks = useMemo(() => {
    const list: { pos: number; type: 'inch' | 'half' | 'quarter'; label?: number }[] = [];
    for (let inch = 0; inch <= inches; inch++) {
      const inchPos = inch * pixelsPerInch;
      if (inchPos <= height) {
        list.push({ pos: inchPos, type: 'inch', label: inch });
      }
      for (let quarter = 1; quarter < 4; quarter++) {
        const pos = inchPos + (quarter * pixelsPerInch) / 4;
        if (pos > height) break;
        let type: 'half' | 'quarter' = quarter === 2 ? 'half' : 'quarter';
        list.push({ pos, type });
      }
    }
    return list;
  }, [height, inches]);

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative w-6 shrink-0 select-none border-r border-slate-300 bg-[#f1f3f4] text-[9px] font-medium text-slate-500 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 print:hidden"
    >
      {/* Top Margin Shading */}
      <div
        style={{ height: `${topMargin}px` }}
        className="absolute top-0 left-0 right-0 bg-slate-300/60 dark:bg-slate-900/60"
      />

      {/* Bottom Margin Shading */}
      <div
        style={{ height: `${bottomMargin}px` }}
        className="absolute bottom-0 left-0 right-0 bg-slate-300/60 dark:bg-slate-900/60"
      />

      {/* Ticks and Labels */}
      {ticks.map((t, idx) => {
        let width = 'w-1.5';
        if (t.type === 'inch') width = 'w-3';
        else if (t.type === 'half') width = 'w-2';
        else width = 'w-1';

        return (
          <div
            key={idx}
            style={{ top: `${t.pos}px` }}
            className={`absolute right-0 h-px bg-slate-400 dark:bg-slate-500 ${width}`}
          >
            {t.label !== undefined && t.label > 0 && t.pos < height - 12 && (
              <span className="absolute -left-3.5 -top-2 font-sans font-semibold text-slate-600 dark:text-slate-300">
                {t.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
