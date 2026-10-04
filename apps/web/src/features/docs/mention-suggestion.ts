import type { CollaboratorDto } from '@qub/shared';
import type { MentionOptions } from '@tiptap/extension-mention';

/**
 * @mention suggestions drawn from the people who actually have access to the document.
 * The server notifies newly mentioned users when the document is saved.
 */
export function mentionSuggestion(getPeople: () => CollaboratorDto[]): MentionOptions['suggestion'] {
  return {
    char: '@',
    items: ({ query }) => {
      const q = query.toLowerCase();
      return getPeople()
        .filter((p) => p.user.name.toLowerCase().includes(q) || p.user.email.toLowerCase().includes(q))
        .slice(0, 8)
        .map((p) => ({ id: p.user.id, label: p.user.name, email: p.user.email }));
    },
    render: () => {
      let el: HTMLDivElement | null = null;
      let items: { id: string; label: string; email: string }[] = [];
      let index = 0;
      let command: ((attrs: { id: string; label: string }) => void) | null = null;

      const draw = () => {
        if (!el) return;
        el.replaceChildren();
        if (!items.length) {
          const empty = document.createElement('div');
          empty.className = 'px-3 py-2 text-sm text-muted';
          empty.textContent = 'No matching people with access';
          el.append(empty);
          return;
        }
        items.forEach((item, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('role', 'option');
          btn.setAttribute('aria-selected', String(i === index));
          btn.className = `flex w-full flex-col px-3 py-1.5 text-left text-sm ${i === index ? 'bg-hover' : ''}`;
          const name = document.createElement('span');
          name.textContent = item.label;
          const email = document.createElement('span');
          email.className = 'text-xs text-muted';
          email.textContent = item.email;
          btn.append(name, email);
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            command?.({ id: item.id, label: item.label });
          });
          el!.append(btn);
        });
      };
      const place = (rect: DOMRect | null) => {
        if (!el || !rect) return;
        el.style.left = `${rect.left + window.scrollX}px`;
        el.style.top = `${rect.bottom + window.scrollY + 4}px`;
      };
      return {
        onStart: (props) => {
          el = document.createElement('div');
          el.setAttribute('role', 'listbox');
          el.setAttribute('aria-label', 'Mention a person');
          el.className = 'absolute z-50 w-64 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-pop';
          document.body.append(el);
          items = props.items as typeof items;
          command = props.command as typeof command;
          index = 0;
          draw();
          place(props.clientRect?.() ?? null);
        },
        onUpdate: (props) => {
          items = props.items as typeof items;
          command = props.command as typeof command;
          index = Math.min(index, Math.max(0, items.length - 1));
          draw();
          place(props.clientRect?.() ?? null);
        },
        onKeyDown: ({ event }) => {
          if (event.key === 'ArrowDown') {
            index = (index + 1) % Math.max(1, items.length);
            draw();
            return true;
          }
          if (event.key === 'ArrowUp') {
            index = (index - 1 + items.length) % Math.max(1, items.length);
            draw();
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            const item = items[index];
            if (item) command?.({ id: item.id, label: item.label });
            return true;
          }
          if (event.key === 'Escape') {
            el?.remove();
            el = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          el?.remove();
          el = null;
        },
      };
    },
  };
}
