import { useRef, type KeyboardEvent } from 'react';

export interface RovingRadioProps {
  ref(el: HTMLButtonElement | null): void;
  tabIndex: 0 | -1;
  onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void;
}

/**
 * Roving-tabindex keyboard navigation for a row of `<button role="radio">` elements (native
 * `<input type="radio">` already gets this from the browser; button-based radio groups don't).
 * Only the checked option — or the first, when none is checked — is a Tab stop. Left/Up and
 * Right/Down move focus to the adjacent option and select it, wrapping at the ends; Home/End
 * jump to the first/last option and select it. Other keys are left alone (not preventDefault'd),
 * so digit/letter respondent shortcuts implemented elsewhere keep working.
 */
export function useRovingRadio<T>(values: readonly T[], current: T | undefined, onChange: (value: T) => void) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const checkedIndex = current === undefined ? -1 : values.indexOf(current);
  const activeIndex = checkedIndex === -1 ? 0 : checkedIndex;

  const moveTo = (index: number) => {
    if (values.length === 0) return;
    const wrapped = ((index % values.length) + values.length) % values.length;
    onChange(values[wrapped]!);
    buttons.current[wrapped]?.focus();
  };

  return (index: number): RovingRadioProps => ({
    ref: (el) => {
      buttons.current[index] = el;
    },
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          moveTo(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          moveTo(index - 1);
          break;
        case 'Home':
          e.preventDefault();
          moveTo(0);
          break;
        case 'End':
          e.preventDefault();
          moveTo(values.length - 1);
          break;
      }
    },
  });
}
