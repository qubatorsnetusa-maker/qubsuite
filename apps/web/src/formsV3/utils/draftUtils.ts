import type { FormConfig, DraftRevision, OfflineSyncItem, FormSubmission } from '../types';

export interface FormDraft {
  form: FormConfig;
  timestamp: number;
  stepCount: number;
  isOffline?: boolean;
}

const DRAFT_PREFIX = 'qubforms_draft_';
const REVISIONS_PREFIX = 'qubforms_revisions_';
const OFFLINE_QUEUE_KEY = 'qubforms_offline_queue';
const OFFLINE_SUBMISSIONS_KEY = 'qubforms_offline_submissions';
const MAX_REVISIONS_PER_FORM = 12;

/**
 * Saves a form draft to localStorage and records a revision checkpoint if significant change
 */
export function saveDraftToStorage(form: FormConfig, isOffline = false, source: DraftRevision['source'] = 'auto_save'): boolean {
  try {
    const draft: FormDraft = {
      form,
      timestamp: Date.now(),
      stepCount: form.steps.length,
      isOffline,
    };
    localStorage.setItem(`${DRAFT_PREFIX}${form.id}`, JSON.stringify(draft));

    // Also record revision checkpoint (throttled to avoid redundant checkpoints)
    recordRevisionCheckpoint(form, source);

    if (isOffline) {
      queueOfflineAction({
        id: `offline-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        action: 'save_form',
        formId: form.id,
        payload: form,
        synced: false,
      });
    }

    return true;
  } catch (err) {
    console.warn('Failed to save draft to localStorage', err);
    return false;
  }
}

/**
 * Retrieves a stored draft for a given formId
 */
export function getDraftFromStorage(formId: string): FormDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${formId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraft;
    if (parsed && parsed.form && parsed.form.id === formId) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Failed to parse draft from localStorage', err);
    return null;
  }
}

/**
 * Removes a stored draft once published or discarded
 */
export function clearDraftFromStorage(formId: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${formId}`);
  } catch (err) {
    console.warn('Failed to clear draft from localStorage', err);
  }
}

/**
 * Records a revision checkpoint in local storage for undo / recovery
 */
export function recordRevisionCheckpoint(
  form: FormConfig,
  source: DraftRevision['source'] = 'auto_save',
  summary?: string
): void {
  try {
    const revisions = getDraftRevisions(form.id);
    const lastRev = revisions[0];

    // Don't duplicate if identical to last revision within 4 seconds
    if (lastRev && Date.now() - lastRev.timestamp < 4000) {
      if (JSON.stringify(lastRev.formSnapshot) === JSON.stringify(form)) {
        return;
      }
    }

    const newRev: DraftRevision = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      formId: form.id,
      timestamp: Date.now(),
      stepCount: form.steps.length,
      formTitle: form.title || 'Untitled Form',
      formSnapshot: JSON.parse(JSON.stringify(form)),
      source,
      summary: summary || (source === 'manual_save' ? 'Manual Save' : source === 'offline_edit' ? 'Offline Edit' : 'Auto-save checkpoint'),
    };

    const updated = [newRev, ...revisions].slice(0, MAX_REVISIONS_PER_FORM);
    localStorage.setItem(`${REVISIONS_PREFIX}${form.id}`, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to record revision checkpoint', err);
  }
}

/**
 * Gets historical revision checkpoints for a form
 */
export function getDraftRevisions(formId: string): DraftRevision[] {
  try {
    const raw = localStorage.getItem(`${REVISIONS_PREFIX}${formId}`);
    if (!raw) return [];
    return JSON.parse(raw) as DraftRevision[];
  } catch {
    return [];
  }
}

/**
 * Clears all revisions for a form
 */
export function clearDraftRevisions(formId: string): void {
  try {
    localStorage.removeItem(`${REVISIONS_PREFIX}${formId}`);
  } catch {}
}

/**
 * Queue an offline action to sync when internet is restored
 */
export function queueOfflineAction(item: OfflineSyncItem): void {
  try {
    const current = getOfflineQueue();
    // Keep max 50 items
    const updated = [item, ...current].slice(0, 50);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to queue offline action', err);
  }
}

/**
 * Gets all pending offline items
 */
export function getOfflineQueue(): OfflineSyncItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clears or marks offline queue items as synced
 */
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {}
}

/**
 * Preserves a submission made while offline
 */
export function saveOfflineSubmission(sub: FormSubmission): void {
  try {
    const current = getOfflineSubmissions();
    const updated = [sub, ...current];
    localStorage.setItem(OFFLINE_SUBMISSIONS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save offline submission', err);
  }
}

export function getOfflineSubmissions(): FormSubmission[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearOfflineSubmissions(): void {
  try {
    localStorage.removeItem(OFFLINE_SUBMISSIONS_KEY);
  } catch {}
}

/**
 * Formats a timestamp into a relative or readable time for UI status
 */
export function formatRelativeDraftTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 4) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Calculates local storage footprint and diagnostics
 */
export function getLocalStorageDiagnostics() {
  let totalChars = 0;
  let qubformsChars = 0;
  let draftCount = 0;
  let revisionCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || '';
      const size = key.length + val.length;
      totalChars += size;
      if (key.startsWith('qubforms_')) {
        qubformsChars += size;
        if (key.startsWith(DRAFT_PREFIX)) draftCount++;
        if (key.startsWith(REVISIONS_PREFIX)) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) revisionCount += arr.length;
          } catch {}
        }
      }
    }
  } catch {}

  // Approx bytes in UTF-16 (2 bytes per char)
  const totalBytes = totalChars * 2;
  const qubformsBytes = qubformsChars * 2;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return {
    qubformsBytes,
    totalBytes,
    formattedQubFormsSize: formatBytes(qubformsBytes),
    formattedTotalSize: formatBytes(totalBytes),
    draftCount,
    revisionCount,
    // Typical localStorage limit is ~5MB
    quotaPercent: Math.min(100, Math.round((totalBytes / (5 * 1024 * 1024)) * 100)),
  };
}

/**
 * Exports complete offline backup package
 */
export function exportAllDraftsBackup(): void {
  try {
    const data: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      app: 'qub-forms',
      version: '1.0',
      items: {},
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('qubforms_')) {
        try {
          data.items[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          data.items[key] = localStorage.getItem(key);
        }
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qubforms-offline-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export offline backup', err);
  }
}
