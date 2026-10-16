/**
 * Shared Email Validation & Typo Detection Utility
 * Designed for both browser (apps/web) and backend (apps/api).
 * Catches common fat-finger typos, bad TLDs, and disposable domains
 * to prevent hard bounces and protect Resend sender reputation.
 */

export const TYPO_DOMAINS: Record<string, string> = {
  // Gmail typos
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmqil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'glemail.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.come': 'gmail.com',
  'gmail.comg': 'gmail.com',
  'gmail.coom': 'gmail.com',

  // Yahoo typos
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yaho.cm': 'yahoo.com',
  'yaho.om': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',

  // Hotmail & Outlook typos
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlock.com': 'outlook.com',

  // iCloud typos
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
};

export const DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'getairmail.com',
  'sharklasers.com',
  'burnermail.io',
  'mytemp.email',
  'temp-mail.org',
  'fakeinbox.com',
  'throwawaymail.com',
  'mohmal.com',
  'inboxkitten.com',
  'disposablemail.com',
  'temp-mail.io',
]);

export interface EmailCheckResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
  email?: string;
  domain?: string;
  localPart?: string;
}

/**
 * Checks email syntax, typo domains, and disposable providers synchronously.
 * Safe for use in browser client and backend.
 */
export function checkEmailSyntaxAndTypo(rawEmail?: string | null): EmailCheckResult {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, reason: 'Email address is required.' };
  }

  const email = rawEmail.trim().toLowerCase();

  // RFC 5322 regex check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Please enter a valid email address (e.g., name@domain.com).' };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid email address format.' };
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain) {
    return { valid: false, reason: 'Invalid email address format.' };
  }

  // Check known typo map
  if (TYPO_DOMAINS[domain]) {
    const suggestedDomain = TYPO_DOMAINS[domain];
    return {
      valid: false,
      reason: `Did you mean @${suggestedDomain}? Please double-check your email domain.`,
      suggestion: `${localPart}@${suggestedDomain}`,
    };
  }

  // Check leading numbers attached to popular mail hosts (e.g. 23gmail.com, 1yahoo.com)
  const leadingNumMatch = domain.match(/^(\d+)(gmail|yahoo|hotmail|outlook)(\.com)$/);
  if (leadingNumMatch) {
    const suggestedDomain = `${leadingNumMatch[2]}${leadingNumMatch[3]}`;
    return {
      valid: false,
      reason: `Did you mean @${suggestedDomain}? Please remove the leading numbers from the domain.`,
      suggestion: `${localPart}@${suggestedDomain}`,
    };
  }

  // Check bad TLD extensions commonly fat-fingered
  if (domain.endsWith('.con') || domain.endsWith('.come') || domain.endsWith('.comm') || domain.endsWith('.cpm')) {
    return {
      valid: false,
      reason: 'Invalid email domain ending (e.g., .con instead of .com). Please check your email.',
    };
  }

  // Check disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Temporary or disposable email addresses are not accepted.',
    };
  }

  return { valid: true, email, domain, localPart };
}

/**
 * Returns a typo suggestion if the domain matches a common mistake.
 */
export function getTypoSuggestion(rawEmail?: string | null): string | null {
  const result = checkEmailSyntaxAndTypo(rawEmail);
  return result.suggestion ?? null;
}
