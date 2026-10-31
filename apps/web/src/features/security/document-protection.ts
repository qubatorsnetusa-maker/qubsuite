/**
 * QubSuite Document & Spreadsheet Password Protection
 * Provides client-side and persistent encryption/hashing for documents and spreadsheets.
 */

export interface ProtectionConfig {
  enabled: boolean;
  hash: string;
  salt: string;
  hint?: string;
  mode: 'open' | 'edit'; // 'open' = require password to view, 'edit' = read-only without password
  protectedAt: string;
}

const STORAGE_PREFIX = 'qub_doc_protection_';
const SESSION_PREFIX = 'qub_unlocked_session_';

async function computeHash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const combined = enc.encode(`${salt}:${password}:qubsuite_security`);
  const buf = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const documentProtection = {
  get(fileId: string): ProtectionConfig | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${fileId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.enabled && parsed.hash && parsed.salt) {
        return parsed as ProtectionConfig;
      }
      return null;
    } catch {
      return null;
    }
  },

  async set(
    fileId: string,
    password: string,
    hint?: string,
    mode: 'open' | 'edit' = 'open',
  ): Promise<ProtectionConfig> {
    const salt = generateSalt();
    const hash = await computeHash(password, salt);
    const config: ProtectionConfig = {
      enabled: true,
      hash,
      salt,
      hint: hint?.trim() || undefined,
      mode,
      protectedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${fileId}`, JSON.stringify(config));
      // Automatically unlock for the user who set the password
      this.unlockSession(fileId);
    } catch (e) {
      console.error('Failed to save document protection', e);
    }
    return config;
  },

  remove(fileId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${fileId}`);
      sessionStorage.removeItem(`${SESSION_PREFIX}${fileId}`);
    } catch (e) {
      console.error('Failed to remove document protection', e);
    }
  },

  async verify(fileId: string, passwordInput: string): Promise<boolean> {
    const config = this.get(fileId);
    if (!config || !config.enabled) return true;
    const computed = await computeHash(passwordInput, config.salt);
    const isValid = computed === config.hash;
    if (isValid) {
      this.unlockSession(fileId);
    }
    return isValid;
  },

  isSessionUnlocked(fileId: string): boolean {
    const config = this.get(fileId);
    if (!config || !config.enabled) return true;
    try {
      return sessionStorage.getItem(`${SESSION_PREFIX}${fileId}`) === 'unlocked';
    } catch {
      return false;
    }
  },

  unlockSession(fileId: string): void {
    try {
      sessionStorage.setItem(`${SESSION_PREFIX}${fileId}`, 'unlocked');
    } catch (e) {
      console.error('Failed to mark session as unlocked', e);
    }
  },

  lockSession(fileId: string): void {
    try {
      sessionStorage.removeItem(`${SESSION_PREFIX}${fileId}`);
    } catch (e) {
      console.error('Failed to lock session', e);
    }
  },
};

