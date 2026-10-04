import type { DefinitionIssue } from '@qub/shared/forms';

/** Problems that belong to the form as a whole (not to one question or variable), e.g. the confirmation message. */
export function FormIssues({ issues }: { issues: DefinitionIssue[] }) {
  const formLevel = issues.filter((i) => i.severity === 'error' && !i.fieldId && !i.variableId);
  if (!formLevel.length) return null;
  return (
    <ul role="alert" aria-label="Form problems" className="space-y-1 rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger">
      {formLevel.map((i, n) => (
        <li key={n}>{i.code === 'unknown_reference' ? `Confirmation message: ${i.message}` : i.message}</li>
      ))}
    </ul>
  );
}
