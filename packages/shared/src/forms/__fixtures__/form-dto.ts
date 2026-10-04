import type { FormFieldType } from '../../enums';
import { DEFAULT_FORM_SETTINGS } from '../../schemas/forms';
import type { FormDto, FormFieldDto, FormVariableDto } from '../../types';

/** Deterministic UUID for tests: uid(1) → 00000000-0000-4000-8000-000000000001. */
export const uid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

export function makeField(id: string, type: FormFieldType, position: number, extra: Partial<FormFieldDto> = {}): FormFieldDto {
  return {
    id,
    ref: `q${position + 1}`,
    type,
    label: `Question ${position + 1}`,
    description: null,
    required: false,
    position,
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

export function makeVariable(id: string, key: string, position: number, extra: Partial<FormVariableDto> = {}): FormVariableDto {
  return { id, key, type: 'NUMBER', initialValue: 0, formula: null, position, ...extra };
}

export function makeForm(fields: FormFieldDto[], extra: Partial<FormDto> = {}): FormDto {
  return {
    id: uid(900),
    fileId: uid(901),
    publicId: 'public-id-000000000000',
    title: 'Test form',
    description: null,
    folderId: null,
    owner: { id: uid(902), name: 'Owner', email: 'owner@example.com', avatarUrl: null },
    isPublished: false,
    acceptingResponses: true,
    publishedAt: null,
    settings: { ...DEFAULT_FORM_SETTINGS },
    theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null },
    fields,
    variables: [],
    responseCount: 0,
    isTrashed: false,
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
    revision: 0,
    capabilities: {} as FormDto['capabilities'],
    ...extra,
  } as FormDto;
}
