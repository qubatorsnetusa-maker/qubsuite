import type { FormFieldDto, SubmitResponseResult } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { SubmitPayload } from '@/services/forms';
import type { RespondentForm } from '../renderer/respondent-form';
import { useFormSession } from './use-form-session';

const f = (id: string, type: FormFieldDto['type'], position: number, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id, ref: id, type, label: id, description: null, required: false, position, validation: {}, settings: {}, options: [], rules: [], placeholder: null, defaultValue: null, scoreConfig: null, ...extra,
});
const form: RespondentForm = {
  title: 'T',
  description: null,
  theme: { primaryColor: '#673ab7', backgroundColor: '#fff', fontFamily: 'sans', headerImageUrl: null },
  settings: { ...DEFAULT_FORM_SETTINGS },
  variables: [],
  fields: [
    f('q1', 'YES_NO', 0, {
      required: true,
      rules: [{ id: 'r', fieldId: 'q1', operator: null, value: null, trigger: 'ON_LEAVE', scope: 'FIELD', condition: { subject: { type: 'field', id: 'q1' }, op: 'eq', value: false }, action: 'JUMP_TO_FIELD', targetSectionId: null, targetFieldId: 'q3', targetVariableId: null, payload: null, position: 0 }],
    }),
    f('q2', 'SHORT_ANSWER', 1, { required: true }),
    f('q3', 'SHORT_ANSWER', 2, { defaultValue: 'prefilled' }),
    f('h', 'HIDDEN', 3, { ref: 'utm' }),
  ],
};
const ok: SubmitResponseResult = { id: 'resp', confirmationMessage: 'Done', message: 'Done', endingId: null, title: null, redirectUrl: null, score: null };

afterEach(() => localStorage.clear());

describe('useFormSession', () => {
  it('applies default values and evaluates the path live', () => {
    const { result } = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: null }));
    expect(result.current.answers.q3).toBe('prefilled');
    expect(result.current.evaluation.path).toEqual(['q1', 'q2', 'q3']);
    act(() => result.current.setAnswer('q1', false));
    expect(result.current.evaluation.path).toEqual(['q1', 'q3']);
  });

  it('ignores a default value on a HIDDEN field (its value comes from the link only)', () => {
    const withHiddenDefault: RespondentForm = { ...form, fields: form.fields.map((x) => (x.id === 'h' ? { ...x, defaultValue: 'from-default' } : x)) };
    const { result } = renderHook(() => useFormSession({ form: withHiddenDefault, submit: vi.fn(), storageKey: null }));
    expect(result.current.answers.h).toBeUndefined();
    expect(result.current.answers.q3).toBe('prefilled');
  });

  it('validates only the requested fields and reports required errors', () => {
    const { result } = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: null }));
    let valid = true;
    act(() => {
      valid = result.current.validate(['q1']);
    });
    expect(valid).toBe(false);
    expect(result.current.errors).toEqual({ q1: 'This question is required' });
  });

  it('submits only answers on the current path (stale branch answers are dropped)', async () => {
    const submit = vi.fn(async (_payload: SubmitPayload) => ok);
    const { result } = renderHook(() => useFormSession({ form, submit, storageKey: null, hidden: { utm: 'mail' } }));
    act(() => {
      result.current.setAnswer('q1', true);
      result.current.setAnswer('q2', 'stale');
    });
    act(() => result.current.setAnswer('q1', false));
    await act(() => result.current.submit());
    const payload = submit.mock.calls[0]![0];
    expect(payload.answers).toEqual({ q1: false, q3: 'prefilled' });
    expect(payload.hidden).toEqual({ utm: 'mail' });
    expect(payload.clientSubmissionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.current.status).toBe('submitted');
    expect(result.current.result).toEqual(ok);
  });

  it('retries network failures with the same idempotency key, then succeeds once', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'))
      .mockRejectedValueOnce(new ApiError(503, 'INTERNAL_ERROR', 'down'))
      .mockResolvedValueOnce(ok);
    const { result } = renderHook(() => useFormSession({ form, submit, storageKey: null, retryDelayMs: 1 }));
    act(() => result.current.setAnswer('q1', false));
    await act(() => result.current.submit());
    expect(submit).toHaveBeenCalledTimes(3);
    const keys = submit.mock.calls.map((c) => c[0].clientSubmissionId);
    expect(new Set(keys).size).toBe(1);
    expect(result.current.status).toBe('submitted');
  });

  it('maps 422 field errors and keeps the same key for a corrected resubmit', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new ApiError(422, 'VALIDATION_ERROR', 'bad', { fieldErrors: { q3: 'Too short' } })).mockResolvedValueOnce(ok);
    const { result } = renderHook(() => useFormSession({ form, submit, storageKey: null }));
    act(() => result.current.setAnswer('q1', false));
    await act(() => result.current.submit());
    expect(result.current.errors).toEqual({ q3: 'Too short' });
    expect(result.current.status).toBe('filling');
    await act(() => result.current.submit());
    expect(submit.mock.calls[0]![0].clientSubmissionId).toBe(submit.mock.calls[1]![0].clientSubmissionId);
  });

  it('saves progress locally, offers to resume, and clears it after submitting', async () => {
    const first = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: 'k' }));
    act(() => first.result.current.setAnswer('q1', true));
    await waitFor(() => expect(localStorage.getItem('k')).toContain('"q1":true'));
    first.unmount();
    const submit = vi.fn(async (_payload: SubmitPayload) => ok);
    const second = renderHook(() => useFormSession({ form, submit, storageKey: 'k' }));
    expect(second.result.current.hasSavedProgress).toBe(true);
    act(() => second.result.current.resume());
    expect(second.result.current.answers.q1).toBe(true);
    act(() => second.result.current.setAnswer('q2', 'x'));
    await act(() => second.result.current.submit());
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('does not persist when the form turns progress saving off', async () => {
    const off = { ...form, settings: { ...form.settings, saveProgress: false } };
    const { result } = renderHook(() => useFormSession({ form: off, submit: vi.fn(), storageKey: 'k2' }));
    act(() => result.current.setAnswer('q1', true));
    await new Promise((r) => setTimeout(r, 500));
    expect(localStorage.getItem('k2')).toBeNull();
  });

  it('persists an email-only edit and restores it on remount', async () => {
    const first = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: 'k3' }));
    act(() => first.result.current.setEmail('a@b.com'));
    await waitFor(() => expect(localStorage.getItem('k3')).toContain('"email":"a@b.com"'));
    first.unmount();
    const second = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: 'k3' }));
    expect(second.result.current.hasSavedProgress).toBe(true);
    act(() => second.result.current.resume());
    expect(second.result.current.email).toBe('a@b.com');
  });

  it('tolerates saved progress with an unknown field id and a mismatched value type', () => {
    localStorage.setItem('k4', JSON.stringify({ v: 1, answers: { q3: 'prefilled', ghost: 'no longer a field', q2: true }, uploads: {}, email: '' }));
    const { result } = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: 'k4' }));
    expect(result.current.hasSavedProgress).toBe(true);
    expect(() => act(() => result.current.resume())).not.toThrow();
    expect(result.current.evaluation.path).toEqual(['q1', 'q2', 'q3']);
    expect(result.current.answers.q2).toBe(true);
  });

  it('pipes answers into text', () => {
    const { result } = renderHook(() => useFormSession({ form, submit: vi.fn(), storageKey: null }));
    act(() => result.current.setAnswer('q1', true));
    expect(result.current.pipe('Answer: {{q1}} / {{q3}}')).toBe('Answer: Yes / prefilled');
  });
});
