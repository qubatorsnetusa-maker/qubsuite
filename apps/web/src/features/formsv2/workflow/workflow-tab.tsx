import type { FormFieldDto } from '@qub/shared';
import { QUESTION_TYPES, validateDefinition, type DefinitionIssue } from '@qub/shared/forms';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SHEET_CLASS } from '@/features/formsv2/content/settings-sidebar';
import { canBranch } from '@/features/forms/builder/can-branch';
import { FormIssues } from '@/features/forms/builder/form-issues';
import { LogicPanel } from '@/features/forms/builder/logic-tab';
import { VariablesPanel } from '@/features/forms/builder/variables-panel';
import { FIELD_UI } from '@/features/forms/registry';
import { questionNumbers } from '../content/question-numbers';
import { useFormV2 } from '../layout/use-form-v2';
import { summarizeRule } from './rule-summary';

/** Left-margin width the jump-arrow SVG occupies, in pixels. */
const GUTTER = 28;

/** The concrete row a rule points at, if any — used to draw the jump arrow. `null` when the rule doesn't jump to a row on this list (e.g. END_FORM with no explicit ending, REDIRECT, SET_VARIABLE, …). */
function jumpTargetId(rule: Pick<FormFieldDto['rules'][number], 'action' | 'targetFieldId' | 'targetSectionId'>): string | null {
  if (rule.action === 'JUMP_TO_FIELD' || rule.action === 'END_FORM' || rule.action === 'SUBMIT_FORM') return rule.targetFieldId;
  if (rule.action === 'GO_TO_SECTION') return rule.targetSectionId;
  return null;
}

interface ArrowSpec {
  key: string;
  fromId: string;
  toId: string;
  kind: 'question' | 'ending';
}

interface ArrowPath {
  key: string;
  d: string;
  kind: 'question' | 'ending';
}

/**
 * Workflow tab: every screen in order (numbered the same way as `question-list.tsx`'s left panel), each question's
 * rules summarised in plain language with a fallback ("Otherwise → next question" / "→ end"), a left-margin SVG of
 * jump arrows, `form-issues` problems shown inline, and the variables panel. Clicking a question's rules (or "Add
 * rule") opens the existing `LogicPanel` in a sheet.
 */
export function WorkflowTab() {
  const { form, canEdit } = useFormV2();
  // Tracked by id (not the field object) so the sheet always shows the current field — it can change (or disappear,
  // e.g. an undo) while open.
  const [logicFieldId, setLogicFieldId] = useState<string | null>(null);
  const logicField = logicFieldId ? (form.fields.find((f) => f.id === logicFieldId) ?? null) : null;

  const issues = useMemo(
    () => validateDefinition({ fields: form.fields, variables: form.variables }, { quiz: form.settings.quiz.enabled, confirmationMessage: form.settings.confirmationMessage }),
    [form.fields, form.variables, form.settings.quiz.enabled, form.settings.confirmationMessage],
  );
  const issuesByField = useMemo(() => {
    const m = new Map<string, DefinitionIssue[]>();
    for (const i of issues) if (i.fieldId) m.set(i.fieldId, [...(m.get(i.fieldId) ?? []), i]);
    return m;
  }, [issues]);

  // The same numbering as the Content tab's list and canvas.
  const numbers = useMemo(() => questionNumbers(form.fields), [form.fields]);

  const specs = useMemo(() => {
    const list: ArrowSpec[] = [];
    for (const field of form.fields) {
      if (!canBranch(field)) continue;
      field.rules
        .filter((r) => r.trigger === 'ON_LEAVE')
        .forEach((r, i) => {
          const targetId = jumpTargetId(r);
          if (!targetId) return;
          const target = form.fields.find((f) => f.id === targetId);
          if (!target) return;
          list.push({ key: `${field.id}:${i}`, fromId: field.id, toId: target.id, kind: target.type === 'ENDING' ? 'ending' : 'question' });
        });
    }
    return list;
  }, [form.fields]);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const [paths, setPaths] = useState<ArrowPath[]>([]);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top;
    const centerOf = (id: string): number | null => {
      const el = rowRefs.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.top - top + r.height / 2;
    };
    const next: ArrowPath[] = [];
    for (const s of specs) {
      const y1 = centerOf(s.fromId);
      const y2 = centerOf(s.toId);
      if (y1 === null || y2 === null) continue;
      const bow = Math.min(GUTTER - 4, Math.max(8, Math.abs(y2 - y1) / 6));
      next.push({ key: s.key, kind: s.kind, d: `M ${GUTTER} ${y1} C ${GUTTER - bow} ${y1} ${GUTTER - bow} ${y2} ${GUTTER} ${y2}` });
    }
    setPaths(next);
  }, [specs]);

  useLayoutEffect(() => recompute(), [recompute]);
  useLayoutEffect(() => {
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [recompute]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <FormIssues issues={issues} />

      <div ref={containerRef} className="relative">
        {/* `h-full` is required: an absolutely positioned <svg> is a replaced element, so `inset-y-0` alone doesn't
            stretch it — it stays at the default 150px and clips every arrow below that. `overflow-visible` keeps
            arrowheads at the very top/bottom row from being cut off. */}
        <svg data-testid="workflow-arrows" className="pointer-events-none absolute inset-y-0 left-0 h-full w-7 overflow-visible" aria-hidden focusable="false">
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill="none" strokeWidth={2} markerEnd={`url(#workflow-arrowhead-${p.kind})`} className={p.kind === 'ending' ? 'text-[#b06000]' : 'text-form'} stroke="currentColor" />
          ))}
          <defs>
            <marker id="workflow-arrowhead-question" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="text-form" fill="currentColor" />
            </marker>
            <marker id="workflow-arrowhead-ending" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="text-[#b06000]" fill="currentColor" />
            </marker>
          </defs>
        </svg>

        <ol className="space-y-3 pl-7">
          {form.fields.map((field, i) => {
            const def = QUESTION_TYPES[field.type];
            const Icon = FIELD_UI[field.type].icon;
            const rules = field.rules.filter((r) => r.trigger === 'ON_LEAVE');
            const fieldIssues = issuesByField.get(field.id) ?? [];
            const hasNext = i < form.fields.length - 1;
            const number = numbers[i] ?? null;
            const name = field.label || def.label;
            return (
              <li key={field.id} ref={(el) => void (el ? rowRefs.current.set(field.id, el) : rowRefs.current.delete(field.id))} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {number !== null ? `${number}. ` : ''}
                    {name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{def.label}</span>
                </div>

                {canBranch(field) && (
                  <div className="mt-2 space-y-1 text-sm">
                    {rules.length > 0 ? (
                      <ul className="space-y-1">
                        {rules.map((r) => (
                          <li key={r.id}>
                            <button type="button" disabled={!canEdit} onClick={() => setLogicFieldId(field.id)} className="block w-full rounded px-2 py-1 text-left text-muted hover:bg-hover hover:text-foreground disabled:hover:bg-transparent">
                              {summarizeRule(form, r)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => setLogicFieldId(field.id)}>
                        Add rule
                      </Button>
                    )}
                    <p className="px-2 text-xs text-subtle">{hasNext ? 'Otherwise → next question' : 'Otherwise → end'}</p>
                  </div>
                )}

                {fieldIssues.some((iss) => iss.severity === 'error') && (
                  <ul role="alert" className="mt-2 space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                    {fieldIssues
                      .filter((iss) => iss.severity === 'error')
                      .map((iss, n) => (
                        <li key={n}>{iss.message}</li>
                      ))}
                  </ul>
                )}
                {fieldIssues.some((iss) => iss.severity === 'warning') && (
                  <ul className="mt-2 space-y-1 rounded-md bg-[#fef7e0] px-3 py-2 text-sm text-warning">
                    {fieldIssues
                      .filter((iss) => iss.severity === 'warning')
                      .map((iss, n) => (
                        <li key={n}>{iss.message}</li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Variables</h2>
        <VariablesPanel form={form} issues={issues} canEdit={canEdit} />
      </section>

      {logicField && <LogicPanel form={form} field={logicField} onClose={() => setLogicFieldId(null)} className={SHEET_CLASS} />}
    </div>
  );
}
