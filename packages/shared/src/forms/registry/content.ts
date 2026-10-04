import type { FormFieldType } from '../../enums';
import type { QuestionTypeDef, TypeCategory } from './types';

function content(type: FormFieldType, category: TypeCategory, label: string, isStep: boolean, defaultLabel: string, settingsKeys: QuestionTypeDef['settingsKeys'], defaultSettings: QuestionTypeDef['defaultSettings'] = {}, estimateSeconds = 3): QuestionTypeDef {
  return {
    type,
    category,
    label,
    isInput: false,
    isStep,
    optionKinds: [],
    settingsKeys,
    validationKeys: [],
    defaultSettings,
    defaultLabel,
    storage: null,
    operators: [],
    analyticsKind: 'none',
    estimateSeconds,
    validate: () => null,
    display: () => '',
    toScalar: () => null,
  };
}

export const CONTENT_TYPES: QuestionTypeDef[] = [
  content('SECTION', 'layout', 'Section', false, 'Untitled section', [], {}, 0),
  content('STATEMENT', 'content', 'Statement', true, 'Statement', ['buttonLabel', 'imageUrl', 'imageAlt'], { buttonLabel: 'Continue' }),
  content('IMAGE_BLOCK', 'content', 'Image', true, 'Image', ['imageUrl', 'imageAlt']),
  content('VIDEO_BLOCK', 'content', 'Video', true, 'Video', ['videoUrl'], {}, 30),
  content('WELCOME', 'screen', 'Welcome screen', false, 'Welcome', ['buttonLabel', 'imageUrl', 'imageAlt'], { buttonLabel: 'Start' }, 0),
  content('ENDING', 'screen', 'Ending screen', false, 'Thank you!', ['buttonLabel', 'imageUrl', 'imageAlt', 'buttonUrl', 'redirectUrl', 'redirectDelay', 'showSubmitAnother', 'badgeIcon'], {}, 0),
];
