export type QuestionType =
  | 'welcome'
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'yes_no'
  | 'dropdown'
  | 'file_upload'
  | 'website'
  | 'multiple_choice'
  | 'rating'
  | 'opinion_scale'
  | 'statement'
  | 'thank_you';

export interface ChoiceOption {
  id: string;
  label: string;
  keyHint?: string; // e.g., 'A', 'B', 'C'
}

export type RegexPresetId =
  | 'none'
  | 'custom'
  | 'email_standard'
  | 'email_corporate'
  | 'phone_us'
  | 'phone_intl'
  | 'url_web'
  | 'letters_only'
  | 'alphanumeric'
  | 'numbers_only'
  | 'currency_usd'
  | 'zip_us'
  | 'postal_uk'
  | 'postal_ca'
  | 'ssn_us'
  | 'slug'
  | 'hex_color'
  | 'handle_twitter'
  | 'handle_github'
  | 'uuid';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
  pattern?: string;
  patternPreset?: RegexPresetId;
  patternFlags?: string;
  patternDescription?: string;
  showCharCount?: boolean;
  disallowSpaces?: boolean;

  // Custom granular error messages
  customErrorMessage?: string; // Fallback
  customRequiredMessage?: string;
  customMinLengthMessage?: string;
  customMaxLengthMessage?: string;
  customPatternMessage?: string;
  customRangeMessage?: string;
}

export type LogicConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_answered'
  | 'is_empty';

export interface LogicRule {
  id: string;
  operator: LogicConditionOperator;
  value?: string | number;
  jumpToStepId: string; // Target step ID or special destination like 'submit' / 'thank_you'
}

export interface StepLogic {
  enabled?: boolean;
  defaultJumpToStepId?: string; // 'next' or specific step ID
  rules?: LogicRule[];
}

export interface FormStep {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
  validation?: ValidationRule;
  // Welcome screen specific
  timeEstimate?: string;
  tagline?: string;
  showKeyboardHint?: boolean;
  heroImagePrompt?: string;
  heroImageStyle?: string;
  heroImageSource?: 'ai_generated' | 'preset' | 'upload' | 'url';
  // Branching / Conditional logic
  logic?: StepLogic;
  // Multiple choice & Dropdown options
  options?: ChoiceOption[];
  allowMultiple?: boolean;
  dropdownPlaceholder?: string;
  // Number specific
  numberMin?: number;
  numberMax?: number;
  numberStep?: number;
  numberPrefix?: string;
  numberSuffix?: string;
  // Date specific
  dateMin?: string;
  dateMax?: string;
  dateDefaultToday?: boolean;
  // Yes/No specific
  yesLabel?: string;
  noLabel?: string;
  // File upload specific
  fileMaxSizeBytes?: number;
  fileAllowedExtensions?: string[];
  fileMaxFiles?: number;
  // Website URL specific
  websitePlaceholder?: string;
  // Rating & Scale specific
  ratingMax?: number; // default 5
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  scaleMax?: number; // e.g. 10
  // Thank you / completion specific
  redirectUrl?: string;
  redirectButtonText?: string;
  autoRedirect?: boolean;
  autoRedirectDelay?: number; // in seconds, default e.g. 5
  showRestartButton?: boolean;
  badgeIcon?: 'check' | 'sparkles' | 'heart' | 'rocket' | 'thumbs_up';
  // Step Header & Cover Image
  headerImage?: string;
  headerImageAlt?: string;
  headerImageLayout?: HeaderImageLayout; // 'banner' | 'inline' | 'split-right' | 'split-left'
  headerImageCaption?: string;
  // Step Background override
  backgroundImage?: string;
  backgroundOpacity?: number; // 0.05 to 1
  backgroundBlur?: BackgroundBlur;
}

export type HeaderImageLayout = 'banner' | 'inline' | 'split-right' | 'split-left';
export type BackgroundFit = 'cover' | 'contain' | 'tile';
export type BackgroundBlur = 'none' | 'sm' | 'md' | 'lg';

export interface FormHeaderConfig {
  enabled?: boolean;
  showLogo?: boolean;
  logoUrl?: string;
  logoHeight?: number; // in px, e.g. 24-56
  logoAlignment?: 'left' | 'center' | 'right';
  brandName?: string;
  showBrandName?: boolean;
  brandTagline?: string;
  websiteUrl?: string;
  websiteLabel?: string;
  headerStyle?: 'minimal' | 'prominent' | 'banner';
  showHeaderBanner?: boolean;
  headerBannerUrl?: string;
  headerBannerHeight?: number; // in px, e.g. 100-220
}

export interface FormFooterConfig {
  enabled: boolean;
  copyrightText?: string;
  showPoweredBy?: boolean; // toggle "Powered by qub-forms"
  privacyPolicyUrl?: string;
  privacyPolicyLabel?: string;
  termsUrl?: string;
  termsLabel?: string;
  supportEmail?: string;
  supportLabel?: string;
  securityBadge?: boolean; // 256-bit SSL encrypted
  alignment?: 'left' | 'center' | 'between';
}

export type FormFontFamily =
  | 'plus-jakarta'
  | 'inter'
  | 'playfair'
  | 'outfit'
  | 'space-grotesk'
  | 'jetbrains-mono'
  | 'lora'
  | 'fraunces';

export type FormBorderRadius =
  | 'rounded-none'
  | 'rounded-md'
  | 'rounded-lg'
  | 'rounded-xl'
  | 'rounded-2xl'
  | 'rounded-3xl'
  | 'rounded-full';

export interface CustomColorPalette {
  enabled?: boolean;
  primaryColorHex: string; // Accent color (buttons, progress, active border)
  backgroundColorHex?: string; // Canvas background
  textColorHex?: string; // Main headings and text
  cardBgColorHex?: string; // Card / options container background
  borderRadius?: FormBorderRadius;
  fontFamily?: FormFontFamily;
}

export type BackgroundDesignType = 'solid' | 'gradient' | 'pattern' | 'image';
export type BackgroundPattern =
  | 'dots'
  | 'grid'
  | 'blueprint'
  | 'diagonal-stripes'
  | 'crosses'
  | 'isometric'
  | 'subtle-noise'
  | 'waves';

export type BackgroundGradient =
  | 'linear-mesh'
  | 'sunset-glow'
  | 'aurora-borealis'
  | 'soft-pastel'
  | 'midnight-nebula'
  | 'cyber-violet'
  | 'mint-fresh'
  | 'warm-sunrise'
  | 'ocean-depth'
  | 'desert-sand';

export interface BackgroundDesignConfig {
  type: BackgroundDesignType;
  gradientPreset?: BackgroundGradient;
  gradientDirection?: 'to-b' | 'to-r' | 'to-br' | 'to-bl' | 'radial';
  pattern?: BackgroundPattern;
  patternOpacity?: number; // 0.05 to 0.4
  patternColor?: string; // hex
  imageUrl?: string;
  imageOpacity?: number; // 0.05 to 1
  imageBlur?: BackgroundBlur;
  imageFit?: BackgroundFit;
  overlayDarkness?: number; // 0 to 0.9
  ambientGlow?: boolean; // subtle ambient glow radial background
}

export interface WelcomeScreenConfig {
  enabled: boolean;
  title: string;
  description?: string; // Rich text / Markdown
  buttonLabel?: string;
  timeEstimate?: string;
  tagline?: string;
  showKeyboardHint?: boolean;
  headerImage?: string;
  headerImageAlt?: string;
  headerImageLayout?: HeaderImageLayout; // 'banner' | 'inline' | 'split-right' | 'split-left'
  headerImageCaption?: string;
  heroImagePrompt?: string;
  heroImageStyle?: string;
  heroImageSource?: 'ai_generated' | 'preset' | 'upload' | 'url';
}

export interface ThankYouConfig {
  title?: string;
  message?: string;
  buttonLabel?: string;
  showRestartButton?: boolean;
  redirectUrl?: string;
  redirectButtonText?: string;
  autoRedirect?: boolean;
  autoRedirectDelay?: number; // in seconds, default e.g. 5
  badgeIcon?: 'check' | 'sparkles' | 'heart' | 'rocket' | 'thumbs_up';
}

export interface FormTheme {
  id: string;
  name: string;
  bgClass: string;
  cardBgClass: string;
  textClass: string;
  mutedClass: string;
  accentClass: string;
  accentBgClass: string;
  accentBorderClass: string;
  borderClass: string;
  primaryColorHex: string;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  recipientEmail: string;
  sendSummaryOnSubmit?: boolean; // include question prompts + responses summary
  customSubject?: string; // e.g. "New response for {form_title}"
  sendAlertsFor?: 'all' | 'high_scores' | 'low_scores';
}

export interface FormConfig {
  id: string;
  title: string;
  description: string;
  themeId: string;
  showProgressBar: boolean;
  showQuestionNumbers: boolean;
  allowKeyboardShortcuts: boolean;
  // Theme Styling Overrides
  primaryColor?: string;
  fontFamily?: FormFontFamily;
  borderRadius?: FormBorderRadius;
  // Custom Color Palette
  customPalette?: CustomColorPalette;
  // Background Design (Solid, Gradient, Pattern, Image, Glow)
  backgroundDesign?: BackgroundDesignConfig;
  // Legacy background images compatibility
  backgroundImage?: string;
  backgroundOpacity?: number; // 0.05 to 1, default 0.25
  backgroundBlur?: BackgroundBlur;
  backgroundFit?: BackgroundFit;
  // Brand Header & Logo
  header?: FormHeaderConfig;
  // Customer / Form Footer
  footer?: FormFooterConfig;
  // Response Email Notifications & Alerts
  notifications?: EmailNotificationConfig;
  steps: FormStep[];
  welcomeScreen?: WelcomeScreenConfig;
  thankYou?: ThankYouConfig;
  updatedAt: string;
  // Real epoch-ms timestamp alongside the display-formatted `updatedAt`
  // string above — needed for actually sorting by recency (the string is a
  // relative label like "2 hours ago" and isn't chronologically sortable).
  updatedAtMs?: number;
  createdAt?: string;
  folder?: string;
  status?: 'published' | 'draft' | 'closed';
  isFavorite?: boolean;
  workspaceId?: string;
  tags?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
  folders: string[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  submittedAt: string;
  responses: Record<string, string | number | string[]>;
  completionTimeSeconds: number;
  notificationSentTo?: string; // recipient email where alert was dispatched
}

export interface FormSessionStats {
  starts: number;
  completions: number;
}

export type ActiveView = 'landing' | 'workspace' | 'builder' | 'fullscreen_demo' | 'submissions';

export type PreviewDevice = 'desktop' | 'mobile';

export interface DraftRevision {
  id: string;
  formId: string;
  timestamp: number;
  stepCount: number;
  formTitle: string;
  formSnapshot: FormConfig;
  source: 'auto_save' | 'manual_save' | 'offline_edit' | 'restore';
  summary?: string;
}

export interface OfflineSyncItem {
  id: string;
  timestamp: number;
  action: 'save_form' | 'submit_response' | 'delete_form';
  formId: string;
  payload: any;
  synced: boolean;
}

export interface StorageEstimateInfo {
  usedBytes: number;
  totalBytes?: number;
  percentUsed?: number;
  draftCount: number;
  revisionsCount: number;
}

export * from './schemas';
export type FormStats = FormSessionStats;

