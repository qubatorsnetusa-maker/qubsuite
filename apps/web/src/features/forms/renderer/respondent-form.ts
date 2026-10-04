import type { FormDto, FormFieldDto, FormSettings, FormThemeDto, FormVariableDto, PublicFormDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';

/** Everything a renderer needs, whether it comes from the public endpoint or the builder's form. */
export interface RespondentForm {
  title: string;
  description: string | null;
  fields: FormFieldDto[];
  variables: FormVariableDto[];
  theme: FormThemeDto;
  settings: Required<FormSettings>;
  signedInEmail?: string | null;
}

export const respondentFormFromPublic = (dto: PublicFormDto): RespondentForm => ({
  title: dto.title,
  description: dto.description,
  fields: dto.fields,
  variables: dto.variables,
  theme: dto.theme,
  settings: { ...DEFAULT_FORM_SETTINGS, ...dto.settings },
  signedInEmail: dto.signedInEmail,
});

export const respondentFormFromDto = (dto: FormDto): RespondentForm => ({
  title: dto.title,
  description: dto.description,
  fields: dto.fields,
  variables: dto.variables,
  theme: dto.theme,
  settings: { ...DEFAULT_FORM_SETTINGS, ...dto.settings },
});
