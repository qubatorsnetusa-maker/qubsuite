import type { NativeFileType } from '@qub/shared';

export interface AppConfig {
  type: NativeFileType;
  /** Product name after "Qub". */
  product: 'Docs' | 'Sheets' | 'Forms' | 'Forms v2';
  /** Singular/plural nouns for headings ("Start a new document", "Recent documents"). */
  noun: string;
  plural: string;
  /** Route roots. */
  home: '/docs' | '/sheets' | '/forms' | '/formsv2';
  gallery: '/docs/templates' | '/sheets/templates' | '/forms/templates' | '/formsv2/templates';
  create: '/docs/new' | '/sheets/new' | '/forms/new' | '/formsv2/new';
  /** Brand color for accents (the "+" on the blank tile, active states). */
  color: string;
  /** Thumbnail shape: documents are pages; sheets and forms are landscape. */
  tileAspect: string;
  /** Where opening a recent file goes; defaults to the file's usual editor (as in Drive). */
  openHref?(item: { id: string; resourceId: string | null }): string;
}

export const APPS: Record<NativeFileType, AppConfig> = {
  DOCUMENT: {
    type: 'DOCUMENT',
    product: 'Docs',
    noun: 'document',
    plural: 'documents',
    home: '/docs',
    gallery: '/docs/templates',
    create: '/docs/new',
    color: '#1a73e8',
    tileAspect: 'aspect-[8.5/11]',
  },
  SPREADSHEET: {
    type: 'SPREADSHEET',
    product: 'Sheets',
    noun: 'spreadsheet',
    plural: 'spreadsheets',
    home: '/sheets',
    gallery: '/sheets/templates',
    create: '/sheets/new',
    color: '#0f9d58',
    tileAspect: 'aspect-[8.5/11]',
  },
  FORM: {
    type: 'FORM',
    product: 'Forms',
    noun: 'form',
    plural: 'forms',
    home: '/forms',
    gallery: '/forms/templates',
    create: '/forms/new',
    color: '#7248b9',
    tileAspect: 'aspect-[8.5/11]',
  },
};

/** Forms v2: the same forms, opened in the Typeform-style builder; new forms start one question at a time. */
export const FORMS_V2_APP: AppConfig = {
  ...APPS.FORM,
  product: 'Forms v2',
  home: '/formsv2',
  gallery: '/formsv2/templates',
  create: '/formsv2/new',
  openHref: (item) => `/formsv2/${item.resourceId}/content`,
};

/** Apps in the Qub launcher, in order. */
export const LAUNCHER_APPS: AppConfig[] = [APPS.DOCUMENT, APPS.SPREADSHEET, APPS.FORM, FORMS_V2_APP];
