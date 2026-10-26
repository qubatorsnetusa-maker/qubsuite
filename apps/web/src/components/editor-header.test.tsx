import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveIndicator, EditableTitle } from './editor-header';

describe('SaveIndicator', () => {
  it('renders saved state', () => {
    render(<SaveIndicator status="saved" />);
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('renders saving state', () => {
    render(<SaveIndicator status="saving" />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('renders offline state', () => {
    render(<SaveIndicator status="offline" />);
    expect(screen.getByText('Offline — changes kept on this device')).toBeInTheDocument();
  });
});

describe('EditableTitle', () => {
  it('renders title value', () => {
    render(<EditableTitle value="My Document" onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('My Document')).toBeInTheDocument();
  });

  it('auto-suggests title from document content when untitled is clicked/focused', () => {
    const onSave = vi.fn();
    render(
      <EditableTitle
        value="Untitled document"
        onSave={onSave}
        onAutoSuggestTitle={() => 'Meeting Notes 2026'}
      />
    );
    const input = screen.getByDisplayValue('Untitled document');
    fireEvent.focus(input);
    expect(onSave).toHaveBeenCalledWith('Meeting Notes 2026');
    expect(screen.getByDisplayValue('Meeting Notes 2026')).toBeInTheDocument();
  });

  it('does not overwrite custom titles when clicked', () => {
    const onSave = vi.fn();
    render(
      <EditableTitle
        value="Existing Custom Document"
        onSave={onSave}
        onAutoSuggestTitle={() => 'Different Line'}
      />
    );
    const input = screen.getByDisplayValue('Existing Custom Document');
    fireEvent.focus(input);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Existing Custom Document')).toBeInTheDocument();
  });
});

