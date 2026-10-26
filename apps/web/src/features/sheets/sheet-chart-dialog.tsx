import type { CellRange } from '@qub/shared';
import { rangeA1 } from '@qub/shared/formula';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect, Switch } from '@/components/ui/form-controls';
import { CHART_COLORS, extractChartData, type ChartType, type SheetChart } from './chart-utils';
import type { SheetStore } from './sheet-store';

export function SheetChartDialog({
  open,
  onOpenChange,
  store,
  sheetId,
  currentRange,
  onInsertChart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: SheetStore;
  sheetId: string;
  currentRange: CellRange;
  onInsertChart: (chart: SheetChart) => void;
}) {
  const [type, setType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('Data Overview');
  const [firstRowHeaders, setFirstRowHeaders] = useState(true);
  const [firstColLabels, setFirstColLabels] = useState(true);

  const { data, series } = extractChartData(store, sheetId, currentRange, firstRowHeaders, firstColLabels);

  const handleInsert = () => {
    const chart: SheetChart = {
      id: `chart-${Date.now()}`,
      type,
      title,
      range: currentRange,
      firstRowHeaders,
      firstColLabels,
      position: { x: 80, y: 80, width: 480, height: 320 },
    };
    onInsertChart(chart);
    onOpenChange(false);
  };

  // Pie chart data structure (uses first series)
  const pieData = data.map((d) => ({
    name: d.name,
    value: Number(series[0] ? d[series[0]] : 0),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Insert Chart" className="max-w-2xl">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted">Chart Type</label>
              <NativeSelect
                value={type}
                onChange={(e) => setType(e.target.value as ChartType)}
                className="mt-1 w-full"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="pie">Pie Chart</option>
              </NativeSelect>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted">Chart Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="mt-1 h-8"
              />
            </div>

            <div className="rounded-lg bg-surface p-2.5 text-xs space-y-2 border border-border">
              <span className="font-medium text-foreground">Data Range</span>
              <p className="font-mono text-muted">{rangeA1(currentRange)}</p>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between gap-2 text-xs">
                <span>Row 1 as headers</span>
                <Switch checked={firstRowHeaders} onCheckedChange={setFirstRowHeaders} />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs">
                <span>Col A as labels</span>
                <Switch checked={firstColLabels} onCheckedChange={setFirstColLabels} />
              </label>
            </div>
          </div>

          {/* Interactive Chart Preview */}
          <div className="sm:col-span-2 flex flex-col justify-center rounded-xl border border-border bg-surface p-3 min-h-[300px]">
            <h4 className="text-sm font-semibold text-center mb-3 text-foreground">{title || 'Preview'}</h4>
            {data.length === 0 ? (
              <p className="text-xs text-muted text-center py-16">
                Select a range with numbers to generate a chart preview.
              </p>
            ) : (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {type === 'bar' ? (
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {series.map((sName, idx) => (
                        <Bar
                          key={sName}
                          dataKey={sName}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  ) : type === 'line' ? (
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {series.map((sName, idx) => (
                        <Line
                          key={sName}
                          type="monotone"
                          dataKey={sName}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  ) : type === 'area' ? (
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
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
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={({ name, percent }) => `${name} (${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={data.length === 0}>
            Insert onto Sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
