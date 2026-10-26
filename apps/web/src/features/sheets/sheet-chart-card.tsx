import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Minus, Move, Trash2 } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { CHART_COLORS, extractChartData, type SheetChart } from './chart-utils';
import type { SheetStore } from './sheet-store';

export function SheetChartCard({
  chart,
  store,
  sheetId,
  canEdit,
  onRemove,
}: {
  chart: SheetChart;
  store: SheetStore;
  sheetId: string;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const [pos, setPos] = useState(chart.position);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data, series } = extractChartData(store, sheetId, chart.range, chart.firstRowHeaders, chart.firstColLabels);

  const pieData = data.map((d) => ({
    name: d.name,
    value: Number(series[0] ? d[series[0]] : 0),
  }));

  const handleMouseDown = (e: MouseEvent) => {
    if (!canEdit) return;
    setDragging(true);
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      setPos((prev) => ({
        ...prev,
        x: Math.max(10, moveEvent.clientX - startX),
        y: Math.max(10, moveEvent.clientY - startY),
      }));
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
      }}
      className={`absolute z-30 rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md transition-shadow ${
        dragging ? 'shadow-2xl ring-2 ring-primary/40' : ''
      }`}
    >
      {/* Header / Drag Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 cursor-grab active:cursor-grabbing bg-slate-50/80 rounded-t-xl select-none"
      >
        <div className="flex items-center gap-2">
          <Move className="size-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[240px]">
            {chart.title}
          </span>
          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
            {chart.type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="rounded p-1 hover:bg-slate-200/60 text-slate-500"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <Minus className="size-3" />
          </button>
          {canEdit && (
            <button
              onClick={onRemove}
              className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-500"
              title="Remove chart"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      {!minimized && (
        <div className="p-3">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chart.type === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {series.map((sName, idx) => (
                    <Bar
                      key={sName}
                      dataKey={sName}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : chart.type === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {series.map((sName, idx) => (
                    <Line
                      key={sName}
                      type="monotone"
                      dataKey={sName}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                    />
                  ))}
                </LineChart>
              ) : chart.type === 'area' ? (
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {series.map((sName, idx) => (
                    <Area
                      key={sName}
                      type="monotone"
                      dataKey={sName}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      fillOpacity={0.25}
                    />
                  ))}
                </AreaChart>
              ) : (
                <PieChart>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
