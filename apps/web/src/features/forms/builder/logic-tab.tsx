import type { Condition, FormDto, FormFieldDto, LogicAction, LogicRuleInput } from '@qub/shared';
import { logicTx, QUESTION_TYPES } from '@qub/shared/forms';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { ConditionEditor, fromEditor, newLeaf, subjectOptions, toEditor, type EditorGroup } from './condition-editor';
import { useBuilderOps } from './ops/builder-ops';

type LeaveAction = Exclude<LogicAction, 'SHOW' | 'HIDE'>;
const ACTIONS: { value: LeaveAction; label: string }[] = [
  { value: 'JUMP_TO_FIELD', label: 'Jump to question' },
  { value: 'GO_TO_SECTION', label: 'Go to section' },
  { value: 'END_FORM', label: 'End the form' },
  { value: 'REDIRECT', label: 'Redirect to a link' },
  { value: 'SHOW_MESSAGE', label: 'Change the final message' },
  { value: 'SET_VARIABLE', label: 'Set a variable' },
  { value: 'CALCULATE', label: 'Calculate a variable' },
];

interface Draft {
  scope: 'FIELD' | 'SECTION';
  group: EditorGroup | null; // null = advanced condition kept as-is
  raw: LogicRuleInput['condition'];
  action: LeaveAction;
  targetFieldId: string | null;
  targetSectionId: string | null;
  targetVariableId: string | null;
  payload: { url?: string; message?: string; formula?: string; value?: string | number | boolean | null } | null;
}

function toDraft(r: FormFieldDto['rules'][number]): Draft {
  return { scope: r.scope, group: toEditor(r.condition), raw: r.condition, action: (r.action === 'SUBMIT_FORM' ? 'END_FORM' : r.action) as LeaveAction, targetFieldId: r.targetFieldId, targetSectionId: r.targetSectionId, targetVariableId: r.targetVariableId, payload: r.payload };
}

interface VisibilityDraft {
  group: EditorGroup | null; // null = advanced condition kept as-is
  raw: Condition;
}

/** A stored rule re-sent exactly as it is. */
function asInput(r: FormFieldDto['rules'][number]): LogicRuleInput {
  return { trigger: r.trigger, scope: r.scope, condition: r.condition, action: r.action, targetFieldId: r.targetFieldId, targetSectionId: r.targetSectionId, targetVariableId: r.targetVariableId, payload: r.payload };
}

/** The stored value if it's a valid option in `list`, else '' so the select shows a placeholder instead of a stale value. */
function validTarget(list: { id: string }[], id: string | null): string {
  return id != null && list.some((x) => x.id === id) ? id : '';
}

/**
 * Logic for one question: when it is shown, and what happens after it is answered. `className` restyles the dialog
 * (Forms v2 shows it as a right-side sheet).
 */
export function LogicPanel({ form, field, onClose, className }: { form: FormDto; field: FormFieldDto; onClose(): void; className?: string }) {
  const selfKey = `field:${field.id}`;
  const options = subjectOptions(form);
  const visibility = field.rules.find((r) => r.trigger === 'VISIBILITY' && r.action === 'SHOW');
  // Rules this panel cannot edit (HIDE rules, further SHOW rules) are saved back unchanged — saving replaces all rules.
  const kept = field.rules.filter((r) => r !== visibility && r.trigger !== 'ON_LEAVE');
  const [showWhen, setShowWhen] = useState<VisibilityDraft | null>(visibility ? { group: toEditor(visibility.condition), raw: visibility.condition } : null);
  const [rules, setRules] = useState<Draft[]>(field.rules.filter((r) => r.trigger === 'ON_LEAVE').map(toDraft));
  const later = form.fields.filter((f) => f.position > field.position);
  const steps = later.filter((f) => QUESTION_TYPES[f.type].isStep);
  const sections = later.filter((f) => f.type === 'SECTION');
  const endings = form.fields.filter((f) => f.type === 'ENDING');
  const plainVariables = form.variables.filter((v) => !v.formula);

  const ops = useBuilderOps();
  const save = () => {
    const out: LogicRuleInput[] = [];
    if (showWhen && (!showWhen.group || showWhen.group.items.length)) {
      out.push({ trigger: 'VISIBILITY', scope: 'FIELD', condition: showWhen.group ? fromEditor(showWhen.group) : showWhen.raw, action: 'SHOW', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null });
    }
    out.push(...kept.map(asInput));
    for (const r of rules) {
      out.push({
        trigger: 'ON_LEAVE',
        scope: r.scope,
        condition: r.group ? fromEditor(r.group) : r.raw,
        action: r.action,
        targetFieldId: r.action === 'JUMP_TO_FIELD' || r.action === 'END_FORM' ? r.targetFieldId : null,
        targetSectionId: r.action === 'GO_TO_SECTION' ? r.targetSectionId : null,
        targetVariableId: r.action === 'SET_VARIABLE' || r.action === 'CALCULATE' ? r.targetVariableId : null,
        payload: r.action === 'REDIRECT' ? { url: r.payload?.url ?? '' } : r.action === 'SHOW_MESSAGE' ? { message: r.payload?.message ?? '' } : r.action === 'CALCULATE' ? { formula: r.payload?.formula ?? '' } : r.action === 'SET_VARIABLE' ? { value: r.payload?.value ?? null } : null,
      });
    }
    ops.apply(logicTx(form, field.id, out));
    onClose();
    toast.success('Logic saved');
  };

  const update = (i: number, patch: Partial<Draft>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Logic for “${field.label || 'this question'}”`} description="Rules run in order; the first rule that moves the respondent wins. The same rules are enforced on the server." className={cn('max-h-[85vh] max-w-2xl overflow-y-auto', className)}>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Show this question</h3>
          {showWhen ? (
            <>
              {showWhen.group ? (
                <ConditionEditor form={form} value={showWhen.group} onChange={(group) => setShowWhen({ ...showWhen, group })} />
              ) : (
                <p className="text-sm text-muted">Advanced condition — edit via the API.</p>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowWhen(null)}>
                Always show
              </Button>
            </>
          ) : (
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowWhen({ group: { mode: 'all', items: [newLeaf(options)] }, raw: { all: [] } })}>
              Only show when…
            </Button>
          )}
          {kept.length > 0 && (
            <p className="text-sm text-muted">
              {kept.length} more show/hide rule{kept.length > 1 ? 's' : ''} — kept as is; edit via the API.
            </p>
          )}
        </section>

        <section className="mt-6 space-y-4">
          <h3 className="text-sm font-medium">After this question</h3>
          {rules.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              {r.scope === 'SECTION' && <p className="text-xs text-muted">Runs when leaving this question’s section.</p>}
              {r.group ? <ConditionEditor form={form} value={r.group} onChange={(group) => update(i, { group })} preferredSubject={selfKey} /> : <p className="text-sm text-muted">Advanced condition — edit via the API.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect aria-label="Then" value={r.action} onChange={(e) => update(i, { action: e.target.value as LeaveAction })}>
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </NativeSelect>
                {r.action === 'JUMP_TO_FIELD' && (
                  <NativeSelect aria-label="Question" value={validTarget(steps, r.targetFieldId)} onChange={(e) => update(i, { targetFieldId: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {steps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || s.ref}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {r.action === 'GO_TO_SECTION' && (
                  <NativeSelect aria-label="Section" value={validTarget(sections, r.targetSectionId)} onChange={(e) => update(i, { targetSectionId: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || 'Untitled section'}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {r.action === 'END_FORM' && (
                  <NativeSelect aria-label="Ending" value={validTarget(endings, r.targetFieldId)} onChange={(e) => update(i, { targetFieldId: e.target.value || null })}>
                    <option value="">Default ending</option>
                    {endings.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || 'Ending'}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {r.action === 'REDIRECT' && <Input aria-label="Redirect URL" className="h-9 w-72" placeholder="https://example.com/?name={{firstName}}" value={r.payload?.url ?? ''} onChange={(e) => update(i, { payload: { url: e.target.value } })} />}
                {(r.action === 'SET_VARIABLE' || r.action === 'CALCULATE') && (
                  <NativeSelect aria-label="Variable" value={r.targetVariableId ?? ''} onChange={(e) => update(i, { targetVariableId: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {plainVariables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.key}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {r.action === 'SET_VARIABLE' && <Input aria-label="Value" className="h-9 w-40" value={String(r.payload?.value ?? '')} onChange={(e) => update(i, { payload: { value: e.target.value === '' || Number.isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) } })} />}
                {r.action === 'CALCULATE' && <Input aria-label="Formula" className="h-9 w-72 font-mono" placeholder="{{price}} * {{quantity}}" value={r.payload?.formula ?? ''} onChange={(e) => update(i, { payload: { formula: e.target.value } })} />}
                <Button type="button" variant="subtle" size="icon-sm" className="ml-auto" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`}>
                  <Trash2 />
                </Button>
              </div>
              {r.action === 'SHOW_MESSAGE' && <Textarea aria-label="Message" placeholder="Thanks {{firstName}}!" value={r.payload?.message ?? ''} onChange={(e) => update(i, { payload: { message: e.target.value } })} />}
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => setRules([...rules, { scope: 'FIELD', group: { mode: 'all', items: [newLeaf(options, selfKey)] }, raw: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null }])}>
            <Plus /> Add rule
          </Button>
        </section>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            Save logic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
