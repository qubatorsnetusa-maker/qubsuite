import type { AnswerValue, LocationValue } from '../../schemas/forms';
import { issue } from '../validation';
import { BOOL_OPS, OBJECT_OPS, PRESENCE_OPS } from './basic';
import type { QuestionTypeDef } from './types';

export const ADDRESS_PARTS = ['line1', 'line2', 'city', 'region', 'postalCode', 'country'] as const;
export type AddressPart = (typeof ADDRESS_PARTS)[number];

const isPlainRecord = (v: AnswerValue): v is Record<string, string> => typeof v === 'object' && v !== null && !Array.isArray(v) && !('label' in v);
const isLocation = (v: AnswerValue): v is LocationValue => typeof v === 'object' && v !== null && !Array.isArray(v) && 'label' in v;

const common = {
  isInput: true,
  isStep: true,
  optionKinds: [],
  validationKeys: [],
  defaultLabel: 'Untitled question',
} as const;

export const ADVANCED_TYPES: QuestionTypeDef[] = [
  {
    ...common,
    type: 'FILE_UPLOAD',
    category: 'advanced',
    label: 'File upload',
    settingsKeys: ['maxFiles', 'maxFileSizeMb', 'allowedFileTypes'],
    defaultSettings: { maxFiles: 1, maxFileSizeMb: 10 },
    storage: 'json',
    operators: PRESENCE_OPS,
    analyticsKind: 'file',
    estimateSeconds: 30,
    validate: (f, v) => {
      const maxFiles = f.settings.maxFiles ?? 1;
      if (!Array.isArray(v)) return issue('file', 'Upload a file');
      return v.length > maxFiles ? issue('max_files', `Upload at most ${maxFiles} file(s)`) : null;
    },
    display: (_f, v) => (Array.isArray(v) ? `${v.length} file${v.length === 1 ? '' : 's'}` : ''),
    toScalar: (_f, v) => (Array.isArray(v) ? v.length : null),
  },
  {
    ...common,
    type: 'SIGNATURE',
    category: 'advanced',
    label: 'Signature',
    settingsKeys: [],
    defaultSettings: {},
    storage: 'json',
    operators: PRESENCE_OPS,
    analyticsKind: 'file',
    estimateSeconds: 15,
    validate: (_f, v) => (Array.isArray(v) && v.length === 1 ? null : issue('signature', 'Add your signature')),
    display: (_f, v) => (Array.isArray(v) && v.length ? 'Signed' : ''),
    toScalar: (_f, v) => Array.isArray(v) && v.length > 0,
  },
  {
    ...common,
    type: 'ADDRESS',
    category: 'advanced',
    label: 'Address',
    settingsKeys: [],
    defaultSettings: {},
    storage: 'json',
    operators: OBJECT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 30,
    validate: (f, v) => {
      if (!isPlainRecord(v) || Object.keys(v).some((k) => !(ADDRESS_PARTS as readonly string[]).includes(k)) || Object.values(v).some((x) => typeof x !== 'string' || x.length > 500)) {
        return issue('address', 'Enter a valid address');
      }
      if (f.required && (!v.line1?.trim() || !v.city?.trim() || !v.country?.trim())) return issue('address_parts', 'Enter street, city and country');
      return null;
    },
    display: (_f, v) => (isPlainRecord(v) ? ADDRESS_PARTS.map((p) => v[p]?.trim()).filter(Boolean).join(', ') : ''),
    toScalar: (_f, v) => (isPlainRecord(v) ? ADDRESS_PARTS.map((p) => v[p]?.trim()).filter(Boolean).join(', ') : null),
  },
  {
    ...common,
    type: 'LOCATION',
    category: 'advanced',
    label: 'Location',
    settingsKeys: ['allowGeolocation'],
    defaultSettings: { allowGeolocation: true },
    storage: 'json',
    operators: OBJECT_OPS,
    analyticsKind: 'text',
    estimateSeconds: 15,
    validate: (_f, v) => (isLocation(v) && v.label.trim() !== '' ? null : issue('location', 'Enter a location')),
    display: (_f, v) => (isLocation(v) ? (v.lat != null && v.lng != null ? `${v.label} (${v.lat.toFixed(5)}, ${v.lng.toFixed(5)})` : v.label) : ''),
    toScalar: (_f, v) => (isLocation(v) ? v.label : null),
  },
  {
    ...common,
    type: 'CONSENT',
    category: 'advanced',
    label: 'Consent',
    settingsKeys: ['consentText'],
    defaultSettings: { consentText: 'I agree to the terms and privacy notice.' },
    storage: 'json',
    operators: BOOL_OPS,
    analyticsKind: 'boolean',
    estimateSeconds: 10,
    validate: (f, v) => {
      if (typeof v !== 'boolean') return issue('boolean', 'Choose whether you agree');
      return f.required && v !== true ? issue('consent', 'You must agree to continue') : null;
    },
    display: (_f, v) => (v === true ? 'Agreed' : v === false ? 'Declined' : ''),
    toScalar: (_f, v) => (typeof v === 'boolean' ? v : null),
  },
];
