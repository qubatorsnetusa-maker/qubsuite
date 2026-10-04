import type { KingsChatEnvironment } from '@qub/shared';
import { KINGSCHAT_ACCOUNTS_URLS } from './constants';

export interface KingsChatTokens {
  accessToken: string;
  expiresInMillis: number;
  refreshToken: string;
}

export class KingsChatPopupError extends Error {
  constructor(
    readonly reason: 'blocked' | 'closed' | 'denied',
    message: string,
  ) {
    super(message);
    this.name = 'KingsChatPopupError';
  }
}

function popupFeatures(): string {
  const width = Math.min(Math.floor(window.outerWidth * 0.9), 950);
  const height = Math.min(Math.floor(window.outerHeight * 0.9), 600);
  const left = Math.floor(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.floor(window.screenY + (window.outerHeight - height) / 8);
  return `toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menubar=0,width=${width},height=${height},left=${left},top=${top}`;
}

/**
 * Opens KingsChat's consent popup and resolves with the tokens it posts back. Only messages from the KingsChat
 * accounts origin are considered; everything else (extensions, iframes) is ignored.
 */
export function loginWindow(options: { clientId: string; scopes: string[] }, environment: KingsChatEnvironment): Promise<KingsChatTokens> {
  const accounts = new URL(KINGSCHAT_ACCOUNTS_URLS[environment]);
  const url = new URL(accounts.href);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('scopes', JSON.stringify(options.scopes));
  url.searchParams.set('redirect_uri', window.location.origin);
  url.searchParams.set('post_message', '1');

  const popup = window.open(url.href, '_blank', popupFeatures());
  if (!popup) return Promise.reject(new KingsChatPopupError('blocked', 'Allow pop-ups for this site to sign in with KingsChat.'));

  return new Promise((resolve, reject) => {
    const finish = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(poll);
      if (!popup.closed) popup.close();
    };
    const onMessage = (event: MessageEvent) => {
      console.log('[loginWindow] postMessage event received from origin:', event.origin, 'data:', event.data);
      if (event.origin !== accounts.origin || !event.data || typeof event.data !== 'object') return;
      const data = event.data as Partial<KingsChatTokens> & { error?: unknown };
      finish();
      if (data.error || typeof data.accessToken !== 'string') {
        console.warn('[loginWindow] KingsChat denied or returned error:', data);
        reject(new KingsChatPopupError('denied', 'KingsChat sign-in was cancelled or refused.'));
      } else {
        resolve({ accessToken: data.accessToken, refreshToken: String(data.refreshToken ?? ''), expiresInMillis: Number(data.expiresInMillis ?? 0) });
      }
    };
    const poll = setInterval(() => {
      if (popup.closed) {
        finish();
        reject(new KingsChatPopupError('closed', 'The KingsChat window was closed.'));
      }
    }, 350);
    window.addEventListener('message', onMessage);
  });
}
