import type { AnswerValue, FormFieldDto } from '@qub/shared';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

export type UploadFn = (fieldId: string, file: File, onProgress: (fraction: number) => void) => Promise<UploadedFile>;

export interface InputProps {
  field: FormFieldDto;
  value: AnswerValue | undefined;
  onChange(value: AnswerValue): void;
  /** Theme accent colour. */
  color: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Id of the element holding the question text (for aria-labelledby). */
  labelledBy: string;
  variant: 'classic' | 'conversational';
  uploaded: UploadedFile[];
  onUploaded(files: UploadedFile[]): void;
  /** Absent in the builder preview: uploads only happen on the live form. */
  upload?: UploadFn;
}

export interface FieldUi {
  icon: LucideIcon;
  /** Respondent control; absent for content blocks, screens, sections and hidden fields. */
  Input?: ComponentType<InputProps>;
  /** Conversational shortcut: the new value for a key press, or undefined to ignore the key. */
  keyToValue?(field: FormFieldDto, key: string, current: AnswerValue | undefined): AnswerValue | undefined;
  /** Whether choosing an answer moves to the next question automatically (conversational). */
  autoAdvance?(field: FormFieldDto): boolean;
}

/** Narrows a stored answer to a plain string-keyed record (matrix cell picks, address parts); `{}` for anything else. */
export function asRecord(v: AnswerValue | undefined): Record<string, string> {
  return v && typeof v === 'object' && !Array.isArray(v) && !('label' in v) ? (v as Record<string, string>) : {};
}
