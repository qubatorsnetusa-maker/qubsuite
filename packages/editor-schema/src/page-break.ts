import { Extension, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/** A manual page break. Default priority on purpose: a high-priority block node would become the schema's default block. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-break', class: 'qub-manual-break' })];
  },
  renderText() {
    return '\n';
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ state, chain, tr, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;
          if ($from.parent.type.spec.code) return false;
          // Pagination and print only honour top-level breaks: inside a list, quote or table (or with a node such as an
          // image selected) the break goes after the enclosing top-level block instead of replacing or nesting.
          if ($from.depth > 1 || selection instanceof NodeSelection) {
            if (!dispatch) return true;
            const after = $from.depth === 0 ? selection.to : $from.after(1);
            tr.insert(after, this.type.create());
            if (!tr.doc.nodeAt(after + 1)?.isTextblock) tr.insert(after + 1, state.schema.nodes.paragraph!.create());
            tr.setSelection(TextSelection.create(tr.doc, after + 2));
            tr.scrollIntoView();
            return true;
          }
          return chain()
            .insertContent({ type: this.name })
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                // Split mid-paragraph: the cursor already sits at the start of the text after the break.
                if ($to.parent.isTextblock) {
                  tr.scrollIntoView();
                  return true;
                }
                // Otherwise the break itself is selected: move into the following block, adding one at the end.
                if ($to.nodeAfter?.isTextblock) {
                  tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                } else {
                  tr.insert($to.pos, state.schema.nodes.paragraph!.create());
                  tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                }
                tr.scrollIntoView();
              }
              return true;
            })
            .run();
        },
    };
  },
});

/** Ctrl/Cmd+Enter inserts a page break (as in Google Docs); outranks StarterKit's HardBreak binding for the same keys. */
export const PageBreakShortcut = Extension.create({
  name: 'pageBreakShortcut',
  priority: 1000,
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});
