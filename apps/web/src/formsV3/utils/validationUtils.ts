import type { FormStep, RegexPresetId, ValidationRule } from '../types';

export interface RegexPreset {
  id: RegexPresetId;
  name: string;
  category: 'Popular' | 'Text & Formats' | 'Identifiers' | 'Regional';
  pattern: string;
  flags?: string;
  example: string;
  description: string;
  defaultError: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    id: 'none',
    name: 'No Pattern Filter',
    category: 'Popular',
    pattern: '',
    example: '',
    description: 'Any text without format restrictions',
    defaultError: '',
  },
  {
    id: 'custom',
    name: 'Custom Regular Expression',
    category: 'Popular',
    pattern: '',
    example: '^pattern$',
    description: 'Write your own custom regular expression with optional regex flags',
    defaultError: 'Please enter a value that matches the required format.',
  },
  {
    id: 'email_standard',
    name: 'Standard Email Address',
    category: 'Popular',
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    example: 'alex.rivera@example.com',
    description: 'Standard email format requiring @ and a valid domain extension',
    defaultError: 'Please enter a valid email address (e.g. name@domain.com).',
  },
  {
    id: 'email_corporate',
    name: 'Business / Edu Domain Email',
    category: 'Popular',
    pattern: '^[^\\s@]+@(?!gmail\\.com|yahoo\\.com|hotmail\\.com|outlook\\.com|aol\\.com)[^\\s@]+\\.[a-zA-Z]{2,}$',
    flags: 'i',
    example: 'sarah@stripe.com or john@stanford.edu',
    description: 'Blocks consumer webmails (gmail, yahoo, hotmail) and requires corporate or school email',
    defaultError: 'Please provide a work or university email address (free webmail addresses are not accepted).',
  },
  {
    id: 'phone_us',
    name: 'US / Canada Phone Number',
    category: 'Popular',
    pattern: '^(?:\\+?1[-.\\s]?)?(?:\\(?([0-9]{3})\\)?[-.\\s]?)?([0-9]{3})[-.\\s]?([0-9]{4})$',
    example: '(415) 555-0199 or +1 415-555-0199',
    description: '10-digit North American telephone number with optional country code (+1) and dashes/parens',
    defaultError: 'Please enter a valid 10-digit North American telephone number.',
  },
  {
    id: 'phone_intl',
    name: 'International Phone (E.164)',
    category: 'Popular',
    pattern: '^\\+[1-9]\\d{1,14}$',
    example: '+447911123456 or +33123456789',
    description: 'Standard ITU E.164 format beginning with + followed by country code and subscriber number',
    defaultError: 'Please enter an international phone number starting with + and country code (e.g. +44 7911 123456).',
  },
  {
    id: 'url_web',
    name: 'Website URL (HTTP / HTTPS)',
    category: 'Popular',
    pattern: '^(https?:\\/\\/)?(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{2,6}\\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$',
    flags: 'i',
    example: 'https://company.org/about',
    description: 'Web address with valid domain name and optional protocol',
    defaultError: 'Please enter a valid website URL starting with http:// or https://',
  },
  {
    id: 'letters_only',
    name: 'Letters & Spaces Only (Names)',
    category: 'Text & Formats',
    pattern: '^[a-zA-ZÀ-ÿ\\s\\-\\\'\\.]+$',
    example: 'Jane Marie Doe-Smith',
    description: 'Allows uppercase, lowercase alphabets, spaces, hyphens, apostrophes, and accented letters',
    defaultError: 'Please use letters and spaces only (no numbers or special symbols).',
  },
  {
    id: 'alphanumeric',
    name: 'Alphanumeric Only (A-Z, 0-9)',
    category: 'Text & Formats',
    pattern: '^[a-zA-Z0-9]+$',
    example: 'INV2026X',
    description: 'Letters and digits only without whitespace or punctuation',
    defaultError: 'Only letters and numbers are permitted (no spaces or punctuation).',
  },
  {
    id: 'numbers_only',
    name: 'Integer Numbers Only',
    category: 'Text & Formats',
    pattern: '^\\d+$',
    example: '984021',
    description: 'Digits 0-9 only, with no decimals, signs, or spaces',
    defaultError: 'Please enter numbers only (digits 0-9).',
  },
  {
    id: 'currency_usd',
    name: 'Currency Amount ($ USD)',
    category: 'Text & Formats',
    pattern: '^\\$?\\d{1,3}(,\\d{3})*(\\.\\d{2})?$|^\\$?\\d+(\\.\\d{2})?$',
    example: '$1,250.00 or 500',
    description: 'Standard currency value with optional $ symbol and two decimal places',
    defaultError: 'Please enter a valid currency amount (e.g. $1,250.00 or 250).',
  },
  {
    id: 'slug',
    name: 'URL Slug / Clean Identifier',
    category: 'Identifiers',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    example: 'spring-product-launch-2026',
    description: 'Lowercase alphanumeric words joined by single hyphens',
    defaultError: 'Use lowercase letters and numbers separated by single hyphens (e.g. my-project-slug).',
  },
  {
    id: 'hex_color',
    name: 'Hex Color Code',
    category: 'Identifiers',
    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
    example: '#10B981 or #FFF',
    description: '3 or 6 digit hexadecimal web color code with leading #',
    defaultError: 'Please enter a valid hex color code like #10B981 or #FFF.',
  },
  {
    id: 'handle_twitter',
    name: 'X / Twitter Handle',
    category: 'Identifiers',
    pattern: '^@?[A-Za-z0-9_]{1,15}$',
    example: '@antigravity_ai',
    description: 'Alphanumeric and underscores, up to 15 characters, optional @ prefix',
    defaultError: 'Please enter a valid handle (1-15 characters, letters, numbers, underscores).',
  },
  {
    id: 'handle_github',
    name: 'GitHub Username',
    category: 'Identifiers',
    pattern: '^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$',
    example: 'octocat-dev',
    description: 'Up to 39 characters, alphanumeric with single non-consecutive hyphens',
    defaultError: 'Please enter a valid GitHub username (up to 39 characters, cannot start or end with hyphen).',
  },
  {
    id: 'uuid',
    name: 'UUID / GUID v4',
    category: 'Identifiers',
    pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    example: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
    description: 'Standard 36-character hyphenated UUID identifier format',
    defaultError: 'Please enter a valid 36-character UUID format (e.g. 123e4567-e89b-12d3-a456-426614174000).',
  },
  {
    id: 'zip_us',
    name: 'US Postal ZIP Code',
    category: 'Regional',
    pattern: '^\\d{5}(?:[-\\s]\\d{4})?$',
    example: '90210 or 94107-1234',
    description: '5-digit standard ZIP or 9-digit ZIP+4 format',
    defaultError: 'Please enter a valid 5-digit US ZIP code or 9-digit ZIP+4 (e.g. 90210).',
  },
  {
    id: 'postal_uk',
    name: 'UK Postal Code',
    category: 'Regional',
    pattern: '^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$',
    flags: 'i',
    example: 'SW1A 1AA or EC1A 1BB',
    description: 'Official United Kingdom postcode structure',
    defaultError: 'Please enter a valid UK postcode (e.g. SW1A 1AA).',
  },
  {
    id: 'postal_ca',
    name: 'Canadian Postal Code',
    category: 'Regional',
    pattern: '^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$',
    example: 'K1A 0B1 or M5V2T6',
    description: 'Canadian alphanumeric postal code (A1A 1A1 format)',
    defaultError: 'Please enter a valid Canadian postal code (e.g. K1A 0B1).',
  },
  {
    id: 'ssn_us',
    name: 'US Social Security Number (SSN)',
    category: 'Regional',
    pattern: '^(?!000|666|9\\d{2})\\d{3}-(?!00)\\d{2}-(?!0000)\\d{4}$',
    example: '123-45-6789',
    description: '9-digit US tax identifier with dashes (excluding invalid sequences)',
    defaultError: 'Please enter a valid SSN format: XXX-XX-XXXX.',
  },
];

/**
 * Safely tests a regex pattern against a candidate value
 */
export function testRegexPattern(
  pattern: string,
  flags: string = '',
  testValue: string
): { isValid: boolean; compileError?: string } {
  if (!pattern || !pattern.trim()) {
    return { isValid: true };
  }
  try {
    const cleanFlags = flags.replace(/[^gimsuy]/g, '');
    const regex = new RegExp(pattern, cleanFlags);
    return { isValid: regex.test(testValue) };
  } catch (err: any) {
    return { isValid: false, compileError: err?.message || 'Invalid Regular Expression syntax' };
  }
}

/**
 * Validates any form step value against its complete ValidationRule configuration.
 * Returns { isValid: boolean, message?: string, ruleFailed?: string }
 */
export function validateFormStepValue(
  step: FormStep,
  value: any
): { isValid: boolean; message?: string; ruleFailed?: string } {
  const v = step.validation;

  // Passthrough screens
  if (step.type === 'welcome' || step.type === 'thank_you' || step.type === 'statement') {
    return { isValid: true };
  }

  // 1. Required check
  if (v?.required) {
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      return {
        isValid: false,
        ruleFailed: 'required',
        message:
          v.customRequiredMessage ||
          v.customErrorMessage ||
          'This question is required. Please provide a response.',
      };
    }
  }

  // If value is empty and not required, pass validation
  const isBlank =
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '');
  if (isBlank) {
    return { isValid: true };
  }

  const strVal = typeof value === 'string' ? value : String(value);

  // 2. Disallow Spaces check
  if (v?.disallowSpaces && /\s/.test(strVal)) {
    return {
      isValid: false,
      ruleFailed: 'disallowSpaces',
      message:
        v.customErrorMessage || 'Spaces are not allowed in this input.',
    };
  }

  // 3. Exact Length check
  if (v?.exactLength !== undefined && v.exactLength > 0) {
    if (strVal.length !== v.exactLength) {
      return {
        isValid: false,
        ruleFailed: 'exactLength',
        message:
          v.customErrorMessage ||
          `This field must be exactly ${v.exactLength} characters (currently ${strVal.length}).`,
      };
    }
  }

  // 4. Min Length check for text
  if (v?.minLength !== undefined && v.minLength > 0) {
    if (strVal.trim().length < v.minLength) {
      return {
        isValid: false,
        ruleFailed: 'minLength',
        message:
          v.customMinLengthMessage ||
          v.customErrorMessage ||
          `Please enter at least ${v.minLength} characters (currently ${strVal.trim().length}).`,
      };
    }
  }

  // 5. Max Length check for text
  if (v?.maxLength !== undefined && v.maxLength > 0) {
    if (strVal.length > v.maxLength) {
      return {
        isValid: false,
        ruleFailed: 'maxLength',
        message:
          v.customMaxLengthMessage ||
          v.customErrorMessage ||
          `Cannot exceed ${v.maxLength} characters (currently ${strVal.length}).`,
      };
    }
  }

  // 6. Number limits
  if (step.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        isValid: false,
        ruleFailed: 'numberNaN',
        message: v?.customErrorMessage || 'Please enter a valid numeric value.',
      };
    }
    if (step.numberMin !== undefined && num < step.numberMin) {
      return {
        isValid: false,
        ruleFailed: 'numberMin',
        message:
          v?.customRangeMessage ||
          v?.customErrorMessage ||
          `Value must be at least ${step.numberMin}.`,
      };
    }
    if (step.numberMax !== undefined && num > step.numberMax) {
      return {
        isValid: false,
        ruleFailed: 'numberMax',
        message:
          v?.customRangeMessage ||
          v?.customErrorMessage ||
          `Value cannot exceed ${step.numberMax}.`,
      };
    }
  }

  // 7. Date limits
  if (step.type === 'date' && typeof value === 'string' && value.trim() !== '') {
    if (step.dateMin && value < step.dateMin) {
      return {
        isValid: false,
        ruleFailed: 'dateMin',
        message:
          v?.customRangeMessage ||
          v?.customErrorMessage ||
          `Date cannot be earlier than ${step.dateMin}.`,
      };
    }
    if (step.dateMax && value > step.dateMax) {
      return {
        isValid: false,
        ruleFailed: 'dateMax',
        message:
          v?.customRangeMessage ||
          v?.customErrorMessage ||
          `Date cannot be later than ${step.dateMax}.`,
      };
    }
  }

  // 8. Built-in type validations if no custom regex overrides them
  if (step.type === 'email' && !v?.pattern) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strVal.trim())) {
      return {
        isValid: false,
        ruleFailed: 'email',
        message:
          v?.customPatternMessage ||
          v?.customErrorMessage ||
          'Please enter a valid email address (e.g. name@domain.com).',
      };
    }
  }

  if (step.type === 'website' && !v?.pattern) {
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    if (!urlPattern.test(strVal.trim())) {
      return {
        isValid: false,
        ruleFailed: 'website',
        message:
          v?.customPatternMessage ||
          v?.customErrorMessage ||
          'Please enter a valid web URL (e.g. https://yourcompany.com).',
      };
    }
  }

  if (step.type === 'phone' && !v?.pattern) {
    const phoneClean = strVal.replace(/[\s\-()+.]/g, '');
    if (phoneClean.length < 7) {
      return {
        isValid: false,
        ruleFailed: 'phone',
        message:
          v?.customPatternMessage ||
          v?.customErrorMessage ||
          'Please enter a complete phone number.',
      };
    }
  }

  // 9. Regular Expression Pattern Validation (Preset or Custom)
  if (v?.pattern && typeof strVal === 'string') {
    try {
      const cleanFlags = (v.patternFlags || '').replace(/[^gimsuy]/g, '');
      const regex = new RegExp(v.pattern, cleanFlags);
      if (!regex.test(strVal)) {
        return {
          isValid: false,
          ruleFailed: 'pattern',
          message:
            v.customPatternMessage ||
            v.customErrorMessage ||
            v.patternDescription ||
            'Please match the requested format.',
        };
      }
    } catch {
      // Regex compilation error handled gracefully
    }
  }

  return { isValid: true };
}
