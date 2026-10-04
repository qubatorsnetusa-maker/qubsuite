import { useEffect, useState } from 'react';
import type { FormConfig } from '../types';

/**
 * Returns the canonical sharable URL for a form by ID — the real public
 * respondent route (`/f/$formId`), reachable by anonymous participants
 * without signing in. Must NOT be derived from the current page's pathname:
 * every internal page (workspace, builder, submissions) is auth-gated, so a
 * link built from `window.location.pathname` would bounce participants to
 * the login screen instead of the form.
 */
export function getSharableFormUrl(formId: string): string {
  if (typeof window === 'undefined') {
    return `/formsv3/f/${encodeURIComponent(formId)}`;
  }
  return `${window.location.origin}/formsv3/f/${encodeURIComponent(formId)}`;
}

// For rendering the sharable URL directly into SSR-ed JSX: `getSharableFormUrl`
// branches on `window`, so calling it straight from a render body produces a
// different string on the server (no window) than on the client's first
// paint, which React flags as a hydration mismatch. This hook renders the
// same SSR-safe fallback on both the server and the client's first pass, then
// corrects to the real origin-based URL in an effect once mounted.
export function useSharableFormUrl(formId: string): string {
  const [url, setUrl] = useState(() => `https://qubforms.app/f/${encodeURIComponent(formId)}`);

  useEffect(() => {
    setUrl(getSharableFormUrl(formId));
  }, [formId]);

  return url;
}

/**
 * Generates an HTML iframe embed snippet for respondent embedding on blogs or websites.
 */
export function getEmbedCode(formId: string, title?: string): string {
  const url = getSharableFormUrl(formId);
  const cleanTitle = title ? title.replace(/"/g, '&quot;') : 'Interactive Form';
  return `<iframe src="${url}" title="${cleanTitle}" width="100%" height="600" frameborder="0" style="border: 0; border-radius: 12px; width: 100%; min-height: 600px;" allow="camera; microphone; autoplay; encrypted-media;"></iframe>`;
}

/**
 * Robust clipboard copy utility with textarea fallback for iFrames and sandboxed environments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Parses the active form ID from the current browser URL (search params or hash).
 */
export function parseFormFromUrl(): { formId: string | null; isDirectResponse: boolean } {
  if (typeof window === 'undefined') {
    return { formId: null, isDirectResponse: false };
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const formFromQuery = searchParams.get('form') || searchParams.get('f') || searchParams.get('id');
    const isDirectResponse = searchParams.get('mode') === 'respond' || Boolean(formFromQuery);

    if (formFromQuery) {
      return { formId: formFromQuery, isDirectResponse };
    }

    // Check hash for #form=... or #/form/...
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));
      const formFromHash = hashParams.get('form') || hashParams.get('f');
      if (formFromHash) {
        return { formId: formFromHash, isDirectResponse: true };
      }

      // Check simple #some-id pattern
      const cleanHash = hash.replace(/^#\/?/, '');
      if (cleanHash && !cleanHash.includes('&') && !cleanHash.includes('=')) {
        return { formId: cleanHash, isDirectResponse: true };
      }
    }
  } catch (e) {
    console.warn('Error parsing form parameter from URL', e);
  }

  return { formId: null, isDirectResponse: false };
}
