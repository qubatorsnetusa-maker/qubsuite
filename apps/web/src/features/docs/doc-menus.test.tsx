import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DocMenus, type DocMenusProps } from './doc-menus';

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

function setup(overrides: Partial<DocMenusProps>) {
  const editor = new Editor({ extensions: documentExtensions(), content: '<p>x</p>' });
  editors.push(editor);
  const noop = () => {};
  render(
    <DocMenus
      editor={editor}
      title="Doc"
      canEdit={false}
      canComment={false}
      canTrash={false}
      canDownload
      outlineOpen={false}
      onVersionHistory={noop}
      onMove={noop}
      onTrash={noop}
      onFind={noop}
      onToggleOutline={noop}
      onWordCount={noop}
      onComment={noop}
      onInsertImage={noop}
      onPrint={noop}
      {...overrides}
    />,
  );
}

describe('File menu download permission', () => {
  it('offers Download and Print when the user may download', async () => {
    setup({ canDownload: true });
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(await screen.findByRole('menuitem', { name: /Download/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Print/ })).toBeInTheDocument();
  });

  it('hides Download and Print when the owner turned downloading off', async () => {
    setup({ canDownload: false });
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(await screen.findByRole('menuitem', { name: /Version history/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Download/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Print/ })).toBeNull();
  });
});
