import type { FormFieldType } from '../../enums';
import type { EngineField, EngineOption } from '../types';

let seq = 0;
export function opt(id: string, label = id, extra: Partial<EngineOption> = {}): EngineOption {
  return { id, label, kind: 'option', value: null, imageUrl: null, ...extra };
}

export function baseField(type: FormFieldType, extra: Partial<EngineField> = {}): EngineField {
  seq += 1;
  const id = extra.id ?? `f${seq}`;
  return {
    id,
    ref: extra.ref ?? id,
    type,
    label: id,
    description: null,
    required: false,
    position: seq,
    validation: {},
    settings: {},
    options: [],
    rules: [],
    scoreConfig: null,
    placeholder: null,
    defaultValue: null,
    ...extra,
  };
}
