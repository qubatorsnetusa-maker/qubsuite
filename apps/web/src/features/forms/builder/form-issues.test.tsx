import { validateDefinition } from '@qub/shared/forms';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormIssues } from './form-issues';

describe('FormIssues', () => {
  it('shows an unknown key in the confirmation message, but not question-level problems', () => {
    const issues = [
      ...validateDefinition({ fields: [], variables: [] }, { confirmationMessage: 'Thanks {{who}}' }),
      { severity: 'error' as const, code: 'missing_label' as const, message: 'Every question needs a title', fieldId: 'q', variableId: null, ruleIndex: null },
    ];
    render(<FormIssues issues={issues} />);
    expect(screen.getByRole('alert', { name: 'Form problems' })).toHaveTextContent('Confirmation message: Unknown name: {{who}}');
    expect(screen.queryByText(/needs a title/)).not.toBeInTheDocument();
  });

  it('renders nothing without form-level errors', () => {
    const { container } = render(<FormIssues issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
