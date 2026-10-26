import type { CellRange } from '@qub/shared';
import { colToLetters } from '@qub/shared/formula';
import { Bold, Italic, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  PRESET_STYLES,
  RULE_TYPE_LABELS,
  type ConditionalFormatRule,
  type ConditionalFormatStyle,
  type ConditionalRuleType,
} from './conditional-format';

interface ConditionalFormatDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  sheetId: string;
  currentRange: CellRange;
  rules: ConditionalFormatRule[];
  onSaveRules(rules: ConditionalFormatRule[]): void;
}

function formatRangeText(rg: CellRange): string {
  const start = `${colToLetters(rg.startCol)}${rg.startRow + 1}`;
  if (rg.startRow === rg.endRow && rg.startCol === rg.endCol) return start;
  return `${start}:${colToLetters(rg.endCol)}${rg.endRow + 1}`;
}

export function ConditionalFormatDialog({
  open,
  onOpenChange,
  sheetId,
  currentRange,
  rules,
  onSaveRules,
}: ConditionalFormatDialogProps) {
  const [localRules, setLocalRules] = useState<ConditionalFormatRule[]>(rules);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // New rule draft state
  const [ruleType, setRuleType] = useState<ConditionalRuleType>('greaterThan');
  const [value1, setValue1] = useState<string>('0');
  const [value2, setValue2] = useState<string>('100');
  const [selectedStyle, setSelectedStyle] = useState<ConditionalFormatStyle>(PRESET_STYLES[0]!.style);

  const activeSheetRules = localRules.filter((r) => r.sheetId === sheetId);

  const handleAddRule = () => {
    const newRule: ConditionalFormatRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sheetId,
      range: currentRange,
      type: ruleType,
      values: ruleType === 'between' || ruleType === 'notBetween' ? [value1, value2] : [value1],
      style: selectedStyle,
    };
    const updated = [...localRules, newRule];
    setLocalRules(updated);
    onSaveRules(updated);
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    const updated = localRules.filter((r) => r.id !== id);
    setLocalRules(updated);
    onSaveRules(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Conditional Formatting" className="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">
              Active Range: <strong className="text-foreground">{formatRangeText(currentRange)}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingRuleId('new')}
              className="gap-1 text-xs"
            >
              <Plus className="size-3.5" /> Add Rule
            </Button>
          </div>

          {editingRuleId === 'new' ? (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-surface-2/50">
              <div className="text-xs font-semibold">Format cells if...</div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Condition</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as ConditionalRuleType)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {ruleType !== 'empty' && ruleType !== 'notEmpty' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-muted mb-1">
                      {ruleType === 'between' || ruleType === 'notBetween' ? 'Min Value' : 'Value'}
                    </label>
                    <input
                      type="text"
                      value={value1}
                      onChange={(e) => setValue1(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {(ruleType === 'between' || ruleType === 'notBetween') && (
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-muted mb-1">Max Value</label>
                      <input
                        type="text"
                        value={value2}
                        onChange={(e) => setValue2(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Style Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_STYLES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSelectedStyle(preset.style)}
                      className="rounded px-2 py-1 text-[11px] font-medium border border-border/80 transition-transform active:scale-95"
                      style={{
                        backgroundColor: preset.style.background ?? '#ffffff',
                        color: preset.style.color ?? '#000000',
                        fontWeight: preset.style.bold ? 600 : 400,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-muted">Fill:</label>
                  <input
                    type="color"
                    value={selectedStyle.background ?? '#dcfce7'}
                    onChange={(e) => setSelectedStyle({ ...selectedStyle, background: e.target.value })}
                    className="size-6 cursor-pointer rounded border border-border"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-muted">Text:</label>
                  <input
                    type="color"
                    value={selectedStyle.color ?? '#166534'}
                    onChange={(e) => setSelectedStyle({ ...selectedStyle, color: e.target.value })}
                    className="size-6 cursor-pointer rounded border border-border"
                  />
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedStyle({ ...selectedStyle, bold: !selectedStyle.bold })}
                    className={`rounded p-1 border text-xs ${selectedStyle.bold ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted'}`}
                  >
                    <Bold className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStyle({ ...selectedStyle, italic: !selectedStyle.italic })}
                    className={`rounded p-1 border text-xs ${selectedStyle.italic ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted'}`}
                  >
                    <Italic className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div
                className="mt-2 rounded p-2 text-center text-xs border border-dashed border-border"
                style={{
                  backgroundColor: selectedStyle.background,
                  color: selectedStyle.color,
                  fontWeight: selectedStyle.bold ? 600 : 400,
                  fontStyle: selectedStyle.italic ? 'italic' : 'normal',
                }}
              >
                Sample Preview Text
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingRuleId(null)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleAddRule}>
                  Add Rule
                </Button>
              </div>
            </div>
          ) : null}

          {/* Rules List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted">Existing Rules ({activeSheetRules.length})</div>
            {activeSheetRules.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center border border-dashed border-border rounded-lg">
                No conditional formatting rules set on this sheet.
              </p>
            ) : (
              activeSheetRules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2.5 bg-surface-1"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-5 shrink-0 rounded border border-border/80"
                      style={{
                        backgroundColor: r.style.background ?? 'transparent',
                        borderColor: r.style.color ?? '#ccc',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        {RULE_TYPE_LABELS[r.type]} {r.values.length > 0 ? `(${r.values.join(' - ')})` : ''}
                      </div>
                      <div className="text-[10px] text-muted">
                        Applies to: {formatRangeText(r.range)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteRule(r.id)}
                    className="size-7 text-muted hover:text-danger"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
