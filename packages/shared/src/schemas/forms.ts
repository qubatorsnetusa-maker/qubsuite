import { z } from 'zod';
import {
  CONDITION_OPS,
  FORM_FIELD_TYPES,
  FORM_LAYOUTS,
  LEGACY_LOGIC_ACTIONS,
  LOGIC_ACTIONS,
  LOGIC_OPERATORS,
  LOGIC_SCOPES,
  LOGIC_TRIGGERS,
  OPTION_KINDS,
  VARIABLE_TYPES,
  type ConditionOp,
} from '../enums';
import { itemNameSchema, templateIdSchema, uuidSchema } from './common';

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
const httpUrlSchema = z.string().trim().max(2000).refine(isHttpUrl, 'Use a link starting with http:// or https://');

export const createFormSchema = z.object({
  title: itemNameSchema.optional(),
  folderId: uuidSchema.optional(),
  /** Start from a template in the Forms gallery (`@qub/shared/templates`). */
  templateId: templateIdSchema.optional(),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

export const quizSettingsSchema = z.object({ enabled: z.boolean(), showScore: z.boolean() });

export const formSettingsSchema = z.object({
  collectEmail: z.boolean().optional(),
  requireSignIn: z.boolean().optional(),
  limitOneResponse: z.boolean().optional(),
  allowEditAfterSubmit: z.boolean().optional(),
  showProgressBar: z.boolean().optional(),
  confirmationMessage: z.string().max(2000).optional(),
  /** classic = Google-Forms pages; conversational = one question at a time. */
  layout: z.enum(FORM_LAYOUTS).optional(),
  showTimeEstimate: z.boolean().optional(),
  /** Conversational: move on automatically after a single-choice answer. */
  autoAdvance: z.boolean().optional(),
  /** Keep respondents' unfinished answers in their browser. */
  saveProgress: z.boolean().optional(),
  quiz: quizSettingsSchema.optional(),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

/** Settings every form has; stored settings are merged over these. */
export const DEFAULT_FORM_SETTINGS: Required<FormSettings> = {
  collectEmail: false,
  requireSignIn: false,
  limitOneResponse: false,
  allowEditAfterSubmit: false,
  showProgressBar: true,
  confirmationMessage: 'Your response has been recorded.',
  layout: 'classic',
  showTimeEstimate: false,
  autoAdvance: true,
  saveProgress: true,
  quiz: { enabled: false, showScore: false },
};

export const updateFormSchema = z.object({
  title: itemNameSchema.optional(),
  description: z.string().max(10_000).nullable().optional(),
  settings: formSettingsSchema.optional(),
  acceptingResponses: z.boolean().optional(),
});
export type UpdateFormInput = z.infer<typeof updateFormSchema>;

const dateBound = z.string().regex(/^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$/, 'Use YYYY-MM-DD');

/** Ending screen badge icons. */
export const ENDING_BADGES = ['check', 'sparkles', 'heart', 'rocket', 'thumbs_up'] as const;
export type EndingBadge = (typeof ENDING_BADGES)[number];

export const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(100_000).optional(),
    maxLength: z.number().int().min(1).max(100_000).optional(),
    pattern: z.string().max(500).optional(),
    patternMessage: z.string().max(200).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
    minSelected: z.number().int().min(0).max(100).optional(),
    maxSelected: z.number().int().min(1).max(100).optional(),
    minDate: dateBound.optional(),
    maxDate: dateBound.optional(),
    /** Custom error messages; blank means the built-in text. */
    requiredMessage: z.string().max(200).optional(),
    lengthMessage: z.string().max(200).optional(),
    rangeMessage: z.string().max(200).optional(),
  })
  .strict();
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

export const fieldSettingsSchema = z
  .object({
    /** RATING: number of stars. LINEAR_SCALE / OPINION_SCALE: upper bound. EMOJI_RATING: 3 or 5. */
    scaleMax: z.number().int().min(2).max(10).optional(),
    /** LINEAR_SCALE / OPINION_SCALE: lower bound (0 or 1). */
    scaleMin: z.number().int().min(0).max(1).optional(),
    minLabel: z.string().max(100).optional(),
    maxLabel: z.string().max(100).optional(),
    maxFiles: z.number().int().min(1).max(10).optional(),
    maxFileSizeMb: z.number().int().min(1).max(100).optional(),
    allowedFileTypes: z.array(z.enum(['image', 'pdf', 'document', 'spreadsheet', 'video', 'audio'])).max(6).optional(),
    shuffleOptions: z.boolean().optional(),
    /** DROPDOWN: type-to-filter list. */
    searchable: z.boolean().optional(),
    /** IMAGE_CHOICE: allow more than one image. */
    allowMultiple: z.boolean().optional(),
    /** SLIDER bounds and step. */
    rangeMin: z.number().min(-1_000_000).max(1_000_000).optional(),
    rangeMax: z.number().min(-1_000_000).max(1_000_000).optional(),
    step: z.number().positive().max(1_000_000).optional(),
    /** CONSENT: the text respondents agree to. */
    consentText: z.string().max(5000).optional(),
    /** STATEMENT / WELCOME / ENDING button text. */
    buttonLabel: z.string().max(60).optional(),
    imageUrl: httpUrlSchema.nullable().optional(),
    imageAlt: z.string().max(300).optional(),
    /** VIDEO_BLOCK: YouTube, Vimeo or https video URL. */
    videoUrl: httpUrlSchema.optional(),
    /** LOCATION: offer "use my location". */
    allowGeolocation: z.boolean().optional(),
    /** NUMBER / SLIDER: text shown before and after the value (e.g. "$", "kg"). */
    prefix: z.string().max(12).optional(),
    suffix: z.string().max(12).optional(),
    /** YES_NO: button labels (answers stay true/false). */
    yesLabel: z.string().max(40).optional(),
    noLabel: z.string().max(40).optional(),
    /** SHORT_ANSWER / PARAGRAPH: show "n / max" when a maximum length is set. */
    showCharCount: z.boolean().optional(),
    /** ENDING: link button, optional delayed redirect (both may pipe answers), Submit-another toggle and badge. */
    buttonUrl: z.string().max(2000).optional(),
    redirectUrl: z.string().max(2000).optional(),
    redirectDelay: z.number().int().min(0).max(60).optional(),
    showSubmitAnother: z.boolean().optional(),
    badgeIcon: z.enum(ENDING_BADGES).optional(),
  })
  .strict();
export type FieldSettings = z.infer<typeof fieldSettingsSchema>;

/** Stable key used by `{{ref}}` piping and formulas. `score` is reserved for the quiz score. */
export const fieldRefSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, 'Use letters, digits and underscores, starting with a letter')
  .refine((s) => s.toLowerCase() !== 'score', '“score” is reserved');
export const variableKeySchema = fieldRefSchema;

export const fieldOptionInputSchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().trim().min(1).max(500),
  kind: z.enum(OPTION_KINDS).default('option'),
  imageUrl: httpUrlSchema.nullable().optional(),
  /** Value used in formulas and exports instead of the label (optional). */
  value: z.string().trim().max(200).nullable().optional(),
});

export const locationValueSchema = z
  .object({ label: z.string().max(500), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })
  .strict();
export type LocationValue = z.infer<typeof locationValueSchema>;

const answerRecordSchema = z.record(z.string().max(100), z.string().max(1000)).refine((r) => Object.keys(r).length <= 200, 'Too many entries');

export const answerValueSchema = z.union([
  z.string().max(100_000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(1000)).max(200),
  locationValueSchema,
  answerRecordSchema,
  z.null(),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

export const scoreConfigSchema = z
  .object({
    /** Points per option id (choice, image choice, checkboxes). */
    optionPoints: z.record(z.string().max(100), z.number().min(-1000).max(1000)).optional(),
    /** Correct answer: option id(s), number, boolean or text. */
    correct: z.union([z.string().max(1000), z.number(), z.boolean(), z.array(z.string().max(100)).max(200)]).optional(),
    /** Points awarded when the answer equals `correct`. */
    points: z.number().min(-1000).max(1000).optional(),
  })
  .strict();
export type ScoreConfig = z.infer<typeof scoreConfigSchema>;

export const createFieldSchema = z.object({
  type: z.enum(FORM_FIELD_TYPES),
  afterFieldId: uuidSchema.nullable().optional(),
  label: z.string().max(1000).optional(),
});
export type CreateFieldInput = z.infer<typeof createFieldSchema>;

export const updateFieldSchema = z.object({
  type: z.enum(FORM_FIELD_TYPES).optional(),
  label: z.string().max(1000).optional(),
  description: z.string().max(5000).nullable().optional(),
  required: z.boolean().optional(),
  validation: fieldValidationSchema.optional(),
  settings: fieldSettingsSchema.optional(),
  options: z.array(fieldOptionInputSchema).max(200).optional(),
  ref: fieldRefSchema.optional(),
  placeholder: z.string().max(200).nullable().optional(),
  defaultValue: answerValueSchema.optional(),
  scoreConfig: scoreConfigSchema.nullable().optional(),
});
export type UpdateFieldInput = z.input<typeof updateFieldSchema>;

export const reorderFieldsSchema = z.object({ fieldIds: z.array(uuidSchema).min(1).max(500) });

// ---------- conditions ----------

export const conditionValueSchema = z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]);
export type ConditionValue = z.infer<typeof conditionValueSchema>;

export const conditionSubjectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('field'), id: uuidSchema }).strict(),
  z.object({ type: z.literal('variable'), id: uuidSchema }).strict(),
  z.object({ type: z.literal('score') }).strict(),
]);
export type ConditionSubject = z.infer<typeof conditionSubjectSchema>;

export interface ConditionLeaf {
  subject: ConditionSubject;
  op: ConditionOp;
  value?: ConditionValue;
}
export type Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition } | ConditionLeaf;

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema).max(50) }).strict(),
    z.object({ any: z.array(conditionSchema).max(50) }).strict(),
    z.object({ not: conditionSchema }).strict(),
    z.object({ subject: conditionSubjectSchema, op: z.enum(CONDITION_OPS), value: conditionValueSchema.optional() }).strict(),
  ]),
);

export const MAX_CONDITION_DEPTH = 5;
export const MAX_CONDITION_LEAVES = 50;

export function conditionDepth(c: Condition): number {
  if ('all' in c) return 1 + Math.max(0, ...c.all.map(conditionDepth));
  if ('any' in c) return 1 + Math.max(0, ...c.any.map(conditionDepth));
  if ('not' in c) return 1 + conditionDepth(c.not);
  return 1;
}

export function conditionLeaves(c: Condition): ConditionLeaf[] {
  if ('all' in c) return c.all.flatMap(conditionLeaves);
  if ('any' in c) return c.any.flatMap(conditionLeaves);
  if ('not' in c) return conditionLeaves(c.not);
  return [c];
}

// ---------- rules ----------

/** The pre-engine rule shape still sent by older clients; converted on the server. */
export const legacyLogicRuleSchema = z
  .object({
    operator: z.enum(LOGIC_OPERATORS),
    value: z.string().max(1000).nullable().default(null),
    action: z.enum(LEGACY_LOGIC_ACTIONS),
    targetSectionId: uuidSchema.nullable().default(null),
  })
  .refine((r) => r.action === 'SUBMIT_FORM' || r.targetSectionId != null, {
    message: 'GO_TO_SECTION requires a target section',
    path: ['targetSectionId'],
  });
export type LegacyLogicRuleInput = z.input<typeof legacyLogicRuleSchema>;
export const legacySetLogicSchema = z.object({ rules: z.array(legacyLogicRuleSchema).max(100) });

export const rulePayloadSchema = z
  .object({
    url: z.string().max(2000).optional(),
    message: z.string().max(5000).optional(),
    formula: z.string().max(2000).optional(),
    value: conditionValueSchema.optional(),
  })
  .strict();
export type RulePayload = z.infer<typeof rulePayloadSchema>;

export const logicRuleSchema = z
  .object({
    trigger: z.enum(LOGIC_TRIGGERS).default('ON_LEAVE'),
    scope: z.enum(LOGIC_SCOPES).default('FIELD'),
    condition: conditionSchema,
    action: z.enum(LOGIC_ACTIONS),
    targetSectionId: uuidSchema.nullable().default(null),
    targetFieldId: uuidSchema.nullable().default(null),
    targetVariableId: uuidSchema.nullable().default(null),
    payload: rulePayloadSchema.nullable().default(null),
  })
  .superRefine((r, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    const visibility = r.action === 'SHOW' || r.action === 'HIDE';
    need(visibility === (r.trigger === 'VISIBILITY'), 'trigger', 'Show/hide rules use the VISIBILITY trigger; other actions run ON_LEAVE');
    switch (r.action) {
      case 'GO_TO_SECTION':
        need(r.targetSectionId != null, 'targetSectionId', 'Choose a section');
        break;
      case 'JUMP_TO_FIELD':
        need(r.targetFieldId != null, 'targetFieldId', 'Choose a question');
        break;
      case 'REDIRECT':
        need(!!r.payload?.url, 'payload', 'Enter a redirect URL');
        break;
      case 'SHOW_MESSAGE':
        need(!!r.payload?.message, 'payload', 'Enter a message');
        break;
      case 'SET_VARIABLE':
        need(r.targetVariableId != null, 'targetVariableId', 'Choose a variable');
        need(r.payload?.value !== undefined, 'payload', 'Enter a value');
        break;
      case 'CALCULATE':
        need(r.targetVariableId != null, 'targetVariableId', 'Choose a variable');
        need(!!r.payload?.formula, 'payload', 'Enter a formula');
        break;
      default:
        break;
    }
    need(conditionDepth(r.condition) <= MAX_CONDITION_DEPTH, 'condition', `Conditions can nest at most ${MAX_CONDITION_DEPTH} levels`);
    need(conditionLeaves(r.condition).length <= MAX_CONDITION_LEAVES, 'condition', `At most ${MAX_CONDITION_LEAVES} conditions per rule`);
  });
export type LogicRuleInput = z.input<typeof logicRuleSchema>;
export type LogicRule = z.output<typeof logicRuleSchema>;

export const setLogicSchema = z.object({ rules: z.array(z.union([legacyLogicRuleSchema, logicRuleSchema])).max(100) });
export type SetLogicRuleInput = z.input<typeof setLogicSchema>['rules'][number];

// ---------- variables ----------

export const createVariableSchema = z.object({
  key: variableKeySchema,
  type: z.enum(VARIABLE_TYPES),
  initialValue: conditionValueSchema.default(null),
  /** When set, the variable is computed from this formula and cannot be the target of rules. */
  formula: z.string().trim().max(2000).nullable().default(null),
});
export type CreateVariableInput = z.input<typeof createVariableSchema>;
export const updateVariableSchema = z.object({
  key: variableKeySchema.optional(),
  type: z.enum(VARIABLE_TYPES).optional(),
  initialValue: conditionValueSchema.optional(),
  formula: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateVariableInput = z.input<typeof updateVariableSchema>;
export const validateFormulaSchema = z.object({ formula: z.string().min(1).max(2000) });

// ---------- theme & submissions ----------

export const THEME_FONT_PAIRS = ['inter', 'playfair', 'lora', 'grotesk', 'dm', 'mono', 'playfairDm', 'loraDm'] as const;
export type ThemeFontPair = (typeof THEME_FONT_PAIRS)[number];
export const THEME_BUTTON_RADII = ['sharp', 'rounded', 'pill'] as const;
export type ThemeButtonRadius = (typeof THEME_BUTTON_RADII)[number];
export const THEME_BACKGROUND_KINDS = ['color', 'gradient', 'image'] as const;
export type ThemeBackgroundKind = (typeof THEME_BACKGROUND_KINDS)[number];
/** How far a background image is softened, so busy photos stop competing with the questions. */
export const THEME_BACKGROUND_BLURS = ['none', 'sm', 'md', 'lg'] as const;
export type ThemeBackgroundBlur = (typeof THEME_BACKGROUND_BLURS)[number];
export const THEME_LOGO_ALIGNS = ['left', 'center', 'right'] as const;
export type ThemeLogoAlign = (typeof THEME_LOGO_ALIGNS)[number];
/**
 * How much room the brand header takes above the form. `banner` puts the brand over the header
 * image (or a block of the primary colour) and is always centred, so it ignores `logoAlign`.
 */
export const THEME_HEADER_STYLES = ['minimal', 'prominent', 'banner'] as const;
export type ThemeHeaderStyle = (typeof THEME_HEADER_STYLES)[number];
/** Bounds the logo height slider, in px. */
export const THEME_LOGO_HEIGHT = { min: 20, max: 64, default: 40 } as const;
/** Bounds the header banner height slider, in px. */
export const THEME_HEADER_BANNER_HEIGHT = { min: 60, max: 240, default: 120 } as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour');

export const themeBackgroundSchema = z
  .object({
    kind: z.enum(THEME_BACKGROUND_KINDS),
    from: hexColor.optional(),
    to: hexColor.optional(),
    angle: z.number().int().min(0).max(360).optional(),
    imageUrl: httpUrlSchema.nullable().optional(),
    dim: z.number().int().min(0).max(80).optional(),
    blur: z.enum(THEME_BACKGROUND_BLURS).optional(),
  })
  .strict();
export type ThemeBackground = z.infer<typeof themeBackgroundSchema>;

export const themeExtrasSchema = z
  .object({
    preset: z.string().max(40).optional(),
    questionColor: hexColor.optional(),
    fontPair: z.enum(THEME_FONT_PAIRS).optional(),
    background: themeBackgroundSchema.optional(),
    buttonRadius: z.enum(THEME_BUTTON_RADII).optional(),
    logoUrl: httpUrlSchema.nullable().optional(),
    logoAlign: z.enum(THEME_LOGO_ALIGNS).optional(),
    headerStyle: z.enum(THEME_HEADER_STYLES).optional(),
    /** Hides the logo without discarding its URL, so it can be switched back on. */
    showLogo: z.boolean().optional(),
    logoHeight: z.number().int().min(THEME_LOGO_HEIGHT.min).max(THEME_LOGO_HEIGHT.max).optional(),
    brandName: z.string().max(80).optional(),
    showBrandName: z.boolean().optional(),
    brandTagline: z.string().max(120).optional(),
    websiteUrl: httpUrlSchema.nullable().optional(),
    websiteLabel: z.string().max(40).optional(),
    headerBannerUrl: httpUrlSchema.nullable().optional(),
    headerBannerHeight: z
      .number()
      .int()
      .min(THEME_HEADER_BANNER_HEIGHT.min)
      .max(THEME_HEADER_BANNER_HEIGHT.max)
      .optional(),
    footerText: z.string().max(200).optional(),
    showPoweredBy: z.boolean().optional(),
  })
  .strict();
export type FormThemeExtras = z.infer<typeof themeExtrasSchema>;

/**
 * What the Design tab shows for a key that is unset. `themeStyle` deliberately does NOT spread this:
 * several keys mean "emit no CSS at all" rather than "emit a default value".
 */
export const DEFAULT_FORM_THEME_EXTRAS = {
  background: { kind: 'color' },
  logoAlign: 'left',
  headerStyle: 'minimal',
  showLogo: true,
  logoHeight: THEME_LOGO_HEIGHT.default,
  brandName: '',
  showBrandName: true,
  brandTagline: '',
  websiteLabel: 'Visit website',
  headerBannerHeight: THEME_HEADER_BANNER_HEIGHT.default,
  footerText: '',
  showPoweredBy: true,
} satisfies FormThemeExtras;

export const formThemeSchema = z.object({
  primaryColor: hexColor,
  backgroundColor: hexColor,
  fontFamily: z.enum(['sans', 'serif', 'mono']),
  headerImageUrl: httpUrlSchema.nullable().optional(),
  extras: themeExtrasSchema.optional(),
});
export type FormThemeInput = z.infer<typeof formThemeSchema>;

export const submitResponseSchema = z.object({
  answers: z.record(uuidSchema, answerValueSchema),
  email: z.string().email().max(254).optional(),
  /** Hidden-field values keyed by the HIDDEN field's ref (usually from URL parameters). */
  hidden: z.record(z.string().max(64), z.string().max(2000)).optional(),
  /** Generated once per submission attempt by the client; retries reuse it (idempotency key). */
  clientSubmissionId: uuidSchema.optional(),
  startedAt: z.iso.datetime().optional(),
});
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
