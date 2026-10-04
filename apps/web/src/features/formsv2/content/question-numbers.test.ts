import type { FormFieldDto } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { questionNumber, questionNumbers } from './question-numbers';

const f = (id: string, type: FormFieldDto['type']) => ({ id, type });

describe('questionNumbers', () => {
  it('numbers input steps, skips a content block’s step number, and never numbers welcome, endings or hidden fields', () => {
    const fields = [f('w', 'WELCOME'), f('a', 'SHORT_ANSWER'), f('h', 'HIDDEN'), f('s', 'STATEMENT'), f('b', 'EMAIL'), f('e', 'ENDING')];
    expect(questionNumbers(fields)).toEqual([null, 1, null, null, 3, null]);
    expect(questionNumber({ fields }, 'b')).toBe(3);
    expect(questionNumber({ fields }, 'h')).toBeNull();
    expect(questionNumber({ fields }, 'missing')).toBeNull();
  });
});
