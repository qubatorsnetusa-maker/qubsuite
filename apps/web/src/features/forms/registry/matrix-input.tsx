import { asRecord, type InputProps } from './types';

/** Grid on wide screens, one card per row on phones. Each row is its own radio group. */
export function MatrixInput({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const rows = field.options.filter((o) => o.kind === 'row');
  const cols = field.options.filter((o) => o.kind === 'column');
  const current = asRecord(value);
  const grid = { gridTemplateColumns: `minmax(8rem, 1.5fr) repeat(${cols.length}, minmax(3.5rem, 1fr))` };
  return (
    <div role="group" aria-labelledby={labelledBy} className="space-y-2">
      <div className="hidden gap-2 text-center text-xs text-muted sm:grid" style={grid} aria-hidden>
        <span />
        {cols.map((c) => (
          <span key={c.id}>{c.label}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.id} role="radiogroup" aria-label={r.label} className="rounded-md border border-border p-3 sm:grid sm:items-center sm:gap-2 sm:border-0 sm:p-0" style={grid}>
          <span className="mb-2 block text-sm font-medium sm:mb-0">{r.label}</span>
          {cols.map((c) => (
            <label key={c.id} className="flex items-center gap-2 py-1 text-sm sm:justify-center">
              <input
                type="radio"
                name={`${field.id}-${r.id}`}
                aria-label={`${r.label}: ${c.label}`}
                disabled={disabled}
                checked={current[r.id] === c.id}
                onChange={() => onChange({ ...current, [r.id]: c.id })}
                style={{ accentColor: color }}
                className="size-4"
              />
              <span className="sm:sr-only">{c.label}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
