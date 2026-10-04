import { createVariableSchema, variableKeySchema, type CreateVariableInput, type FormDto, type FormVariableDto, type VariableType } from '@qub/shared';
import { createVariableTx, deleteVariableTx, updateVariableTx, usedKeys, type DefinitionIssue } from '@qub/shared/forms';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, NativeSelect } from '@/components/ui/form-controls';
import { formsService } from '@/services/forms';
import { applyWithUndoToast, useBuilderOps } from './ops/builder-ops';
import { pipeSuggestions, PipingInput } from './piping-input';

const TYPES: VariableType[] = ['NUMBER', 'TEXT', 'BOOLEAN', 'DATE'];

/** Debounced server-side formula check (same parser and key list as publishing). */
function useFormulaCheck(formId: string, formula: string) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!formula.trim()) return setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await formsService.validateFormula(formId, formula);
        setError(r.ok ? null : r.error);
      } catch {
        setError(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [formId, formula]);
  return error;
}

function VariableRow({ form, v, issues, canEdit }: { form: FormDto; v: FormVariableDto; issues: DefinitionIssue[]; canEdit: boolean }) {
  const ops = useBuilderOps();
  const [formula, setFormula] = useState(v.formula ?? '');
  // Show the current formula after undo, redo or someone else's edit.
  useEffect(() => setFormula(v.formula ?? ''), [v.formula]);
  const error = useFormulaCheck(form.id, formula);
  const update = (input: Parameters<typeof updateVariableTx>[2]) => ops.apply(updateVariableTx(form, v.id, input));
  const remove = () => {
    applyWithUndoToast(ops, deleteVariableTx(form, v.id), `Variable “${v.key}” deleted`);
  };
  return (
    <li className="space-y-1 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm">{`{{${v.key}}}`}</code>
        <span className="text-xs text-muted">{v.type.toLowerCase()}</span>
        <PipingInput aria-label={`Formula for ${v.key}`} className="h-8 font-mono" placeholder="Fixed value (no formula)" value={formula} onChange={setFormula} onBlur={() => canEdit && formula !== (v.formula ?? '') && !error && update({ formula: formula || null })} suggestions={pipeSuggestions(form).filter((s) => s.key !== v.key)} disabled={!canEdit} />
        {canEdit && (
          <Button variant="subtle" size="icon-sm" onClick={remove} aria-label={`Delete ${v.key}`}>
            <Trash2 />
          </Button>
        )}
      </div>
      <FieldError message={error ?? issues.find((i) => i.variableId === v.id)?.message} />
    </li>
  );
}

/** `canEdit` (default true) false shows the variables read-only: formulas disabled, no add or delete controls. */
export function VariablesPanel({ form, issues, canEdit = true }: { form: FormDto; issues: DefinitionIssue[]; canEdit?: boolean }) {
  const ops = useBuilderOps();
  const [key, setKey] = useState('');
  const [type, setType] = useState<VariableType>('NUMBER');
  const [formula, setFormula] = useState('');
  const error = useFormulaCheck(form.id, formula);
  // Same rule and message as the server: a question key or another variable already has this name (any case).
  const taken = key && usedKeys(form).some((k) => k.toLowerCase() === key.toLowerCase()) ? `The name “${key}” is already used in this form.` : null;
  const create = () => {
    if (taken) return;
    const input: CreateVariableInput = { key, type, initialValue: type === 'NUMBER' ? 0 : type === 'BOOLEAN' ? false : null, formula: formula.trim() || null };
    // Checked here so an invalid variable gets a message instead of a transaction the server would refuse.
    const parsed = createVariableSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(`Can’t add this variable: ${issue ? `${issue.path.join('.') || 'value'} — ${issue.message}` : 'it isn’t valid'}.`);
      return;
    }
    ops.apply(createVariableTx(form, input).tx);
    setKey('');
    setFormula('');
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Use variables in text as {'{{name}}'}, in logic conditions, and in formulas like {'{{price}} * {{quantity}}'}.</p>
      <ul className="space-y-2">
        {form.variables.map((v) => (
          <VariableRow key={v.id} form={form} v={v} issues={issues} canEdit={canEdit} />
        ))}
        {form.variables.length === 0 && <li className="text-sm text-muted">No variables yet.</li>}
      </ul>
      {canEdit && (
        <div className="space-y-2 rounded-md bg-surface p-3">
          <div className="flex flex-wrap gap-2">
            <Input aria-label="New variable name" className="h-8 w-40 font-mono" placeholder="total" value={key} onChange={(e) => setKey(e.target.value)} />
            <NativeSelect aria-label="New variable type" value={type} onChange={(e) => setType(e.target.value as VariableType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toLowerCase()}
                </option>
              ))}
            </NativeSelect>
          </div>
          <PipingInput aria-label="New variable formula" className="h-8 font-mono" placeholder="Optional formula, e.g. {{price}} * {{quantity}}" value={formula} onChange={setFormula} suggestions={pipeSuggestions(form)} />
          <FieldError message={taken ?? error ?? undefined} />
          <Button size="sm" onClick={create} disabled={!variableKeySchema.safeParse(key).success || !!taken || !!error}>
            Add variable
          </Button>
        </div>
      )}
    </div>
  );
}
