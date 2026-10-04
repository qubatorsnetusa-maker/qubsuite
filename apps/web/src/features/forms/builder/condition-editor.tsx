import type { Condition, ConditionLeaf, ConditionOp, ConditionSubject, ConditionValue, FormDto, FormFieldDto } from '@qub/shared';
import { BOOL_OPS, NUMBER_OPS, QUESTION_TYPES, TEXT_OPS } from '@qub/shared/forms';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/form-controls';

export const OP_LABEL: Record<ConditionOp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  not_contains: 'doesn’t contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: 'is greater than',
  lt: 'is less than',
  gte: 'is at least',
  lte: 'is at most',
  answered: 'is answered',
  unanswered: 'is not answered',
};

export interface SubjectOption {
  key: string;
  label: string;
  subject: ConditionSubject;
  field?: FormFieldDto;
  operators: readonly ConditionOp[];
  valueKind: 'none' | 'option' | 'boolean' | 'number' | 'date' | 'text';
}

function valueKindOf(field: FormFieldDto): SubjectOption['valueKind'] {
  const def = QUESTION_TYPES[field.type];
  if (field.options.some((o) => o.kind === 'option') && field.type !== 'RANKING') return 'option';
  if (def.analyticsKind === 'boolean') return 'boolean';
  if (def.storage === 'number') return 'number';
  if (field.type === 'DATE' || field.type === 'DATETIME') return 'date';
  return def.operators.length > 2 ? 'text' : 'none';
}

export function subjectOptions(form: Pick<FormDto, 'fields' | 'variables'>): SubjectOption[] {
  const fields = form.fields
    .filter((f) => QUESTION_TYPES[f.type].operators.length > 0)
    .map((f) => ({ key: `field:${f.id}`, label: f.label || f.ref, subject: { type: 'field' as const, id: f.id }, field: f, operators: QUESTION_TYPES[f.type].operators, valueKind: valueKindOf(f) }));
  const variables = form.variables.map((v) => ({
    key: `variable:${v.id}`,
    label: `{{${v.key}}}`,
    subject: { type: 'variable' as const, id: v.id },
    operators: v.type === 'BOOLEAN' ? BOOL_OPS : v.type === 'TEXT' ? TEXT_OPS : NUMBER_OPS,
    valueKind: (v.type === 'BOOLEAN' ? 'boolean' : v.type === 'TEXT' ? 'text' : v.type === 'DATE' ? 'date' : 'number') as SubjectOption['valueKind'],
  }));
  return [...fields, ...variables, { key: 'score', label: 'Score', subject: { type: 'score' }, operators: NUMBER_OPS, valueKind: 'number' }];
}

const subjectKey = (s: ConditionSubject) => (s.type === 'score' ? 'score' : `${s.type}:${s.id}`);

export interface EditorLeaf {
  negate: boolean;
  leaf: ConditionLeaf;
}
export interface EditorGroup {
  mode: 'all' | 'any';
  items: (EditorLeaf | EditorGroup)[];
}
const isGroup = (x: EditorLeaf | EditorGroup): x is EditorGroup => 'mode' in x;

function toItem(c: Condition, depth: number): EditorLeaf | EditorGroup | null {
  if ('not' in c) return 'subject' in c.not ? { negate: true, leaf: c.not } : null;
  if ('subject' in c) return { negate: false, leaf: c };
  if (depth >= 1) {
    // Sub-groups may only contain (possibly negated) leaves.
    const list = 'all' in c ? c.all : c.any;
    const items = list.map((x) => ('subject' in x ? { negate: false, leaf: x } : 'not' in x && 'subject' in x.not ? { negate: true, leaf: x.not } : null));
    return items.every(Boolean) ? { mode: 'all' in c ? 'all' : 'any', items: items as EditorLeaf[] } : null;
  }
  return null;
}

export function toEditor(c: Condition): EditorGroup | null {
  if ('subject' in c || 'not' in c) {
    const item = toItem(c, 0);
    return item ? { mode: 'all', items: [item] } : null;
  }
  const list = 'all' in c ? c.all : c.any;
  const items = list.map((x) => ('all' in x || 'any' in x ? toItem(x, 1) : toItem(x, 0)));
  return items.every(Boolean) ? { mode: 'all' in c ? 'all' : 'any', items: items as (EditorLeaf | EditorGroup)[] } : null;
}

export function fromEditor(g: EditorGroup): Condition {
  const items = g.items.map((x): Condition => (isGroup(x) ? fromEditor(x) : x.negate ? { not: x.leaf } : x.leaf));
  return g.mode === 'all' ? { all: items } : { any: items };
}

export function newLeaf(options: SubjectOption[], preferred?: string): EditorLeaf {
  const s = options.find((o) => o.key === preferred) ?? options[0]!;
  return { negate: false, leaf: { subject: s.subject, op: s.operators.includes('eq') ? 'eq' : s.operators[0]!, value: null } };
}

function ValueInput({ option, value, onChange, label }: { option: SubjectOption; value: ConditionValue | undefined; onChange(v: ConditionValue): void; label: string }) {
  switch (option.valueKind) {
    case 'none':
      return null;
    case 'option':
      return (
        <NativeSelect aria-label={label} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Choose…</option>
          {option.field!.options.filter((o) => o.kind === 'option').map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    case 'boolean':
      return (
        <NativeSelect aria-label={label} value={value === true ? 'true' : value === false ? 'false' : ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">Choose…</option>
          <option value="true">Yes / true</option>
          <option value="false">No / false</option>
        </NativeSelect>
      );
    case 'number':
      return <Input aria-label={label} type="number" step="any" className="h-9 w-28" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <Input aria-label={label} type="date" className="h-9 w-40" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} />;
    default:
      return <Input aria-label={label} className="h-9 w-40" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function LeafRow({ item, options, index, onChange, onRemove }: { item: EditorLeaf; options: SubjectOption[]; index: number; onChange(x: EditorLeaf): void; onRemove(): void }) {
  const option = options.find((o) => o.key === subjectKey(item.leaf.subject)) ?? options[0]!;
  const needsValue = item.leaf.op !== 'answered' && item.leaf.op !== 'unanswered';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label={`Not ${index}`} value={item.negate ? 'not' : ''} onChange={(e) => onChange({ ...item, negate: e.target.value === 'not' })} className="w-20">
        <option value="">if</option>
        <option value="not">if not</option>
      </NativeSelect>
      <NativeSelect
        aria-label={`Subject ${index}`}
        value={option.key}
        onChange={(e) => {
          const next = options.find((o) => o.key === e.target.value)!;
          onChange({ ...item, leaf: { subject: next.subject, op: next.operators.includes(item.leaf.op) ? item.leaf.op : next.operators[0]!, value: null } });
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={`Operator ${index}`} value={item.leaf.op} onChange={(e) => onChange({ ...item, leaf: { ...item.leaf, op: e.target.value as ConditionOp } })}>
        {option.operators.map((op) => (
          <option key={op} value={op}>
            {OP_LABEL[op]}
          </option>
        ))}
      </NativeSelect>
      {needsValue && <ValueInput option={option} value={item.leaf.value} label={`Value ${index}`} onChange={(value) => onChange({ ...item, leaf: { ...item.leaf, value } })} />}
      <Button type="button" variant="subtle" size="icon-sm" onClick={onRemove} aria-label={`Remove condition ${index}`}>
        <X />
      </Button>
    </div>
  );
}

/** Root group of conditions (all/any), with optional one-level sub-groups. Numbering is global for labels. */
export function ConditionEditor({ form, value, onChange, preferredSubject }: { form: Pick<FormDto, 'fields' | 'variables'>; value: EditorGroup; onChange(g: EditorGroup): void; preferredSubject?: string }) {
  const options = subjectOptions(form);
  let counter = 0;
  const renderGroup = (g: EditorGroup, update: (g: EditorGroup) => void, nested: boolean) => (
    <div className={nested ? 'space-y-2 rounded-md border border-border p-2' : 'space-y-2'}>
      {g.items.length > 1 && (
        <NativeSelect aria-label={nested ? 'Sub-group match' : 'Match'} value={g.mode} onChange={(e) => update({ ...g, mode: e.target.value as 'all' | 'any' })} className="w-48">
          <option value="all">All conditions (AND)</option>
          <option value="any">Any condition (OR)</option>
        </NativeSelect>
      )}
      {g.items.map((item, i) => {
        const replace = (next: EditorLeaf | EditorGroup) => update({ ...g, items: g.items.map((x, j) => (j === i ? next : x)) });
        const remove = () => update({ ...g, items: g.items.filter((_, j) => j !== i) });
        if (isGroup(item)) return <div key={i}>{renderGroup(item, (sub) => (sub.items.length ? replace(sub) : remove()), true)}</div>;
        counter += 1;
        return <LeafRow key={i} item={item} options={options} index={counter} onChange={replace} onRemove={remove} />;
      })}
      <div className="flex gap-2">
        <Button type="button" variant="subtle" size="sm" onClick={() => update({ ...g, items: [...g.items, newLeaf(options, preferredSubject)] })}>
          <Plus /> Condition
        </Button>
        {!nested && (
          <Button type="button" variant="subtle" size="sm" onClick={() => update({ ...g, items: [...g.items, { mode: 'any', items: [newLeaf(options, preferredSubject)] }] })}>
            <Plus /> Group
          </Button>
        )}
      </div>
    </div>
  );
  return renderGroup(value, onChange, false);
}
