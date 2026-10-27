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
    let finished = false;
    const isAndroidApp = typeof navigator !== 'undefined' && /QubDocsAndroid/i.test(navigator.userAgent);

    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('message', onMessage);
      window.removeEventListener('kingschat:closed', onClosed);
      clearInterval(poll);
      clearTimeout(timeout);
      try {
        if (!popup.closed) popup.close();
      } catch {}
    };

    const onClosed = () => {
      finish();
      reject(new KingsChatPopupError('closed', 'The KingsChat window was closed.'));
    };

    const onMessage = (event: MessageEvent) => {
      console.log('[loginWindow] postMessage event received from origin:', event.origin, 'data:', event.data);
      const isAllowedOrigin = event.origin === accounts.origin || (isAndroidApp && event.origin === window.location.origin);
      if (!isAllowedOrigin || !event.data) return;
      
      let parsedData: any = event.data;
      if (typeof parsedData === 'string') {
        try { parsedData = JSON.parse(parsedData); } catch {}
      }
      if (typeof parsedData !== 'object' || !parsedData) return;

      const data = parsedData as Partial<KingsChatTokens> & { error?: unknown; accessToken?: string };
      if (!data.accessToken && !data.error) return;

      finish();
      if (data.error || typeof data.accessToken !== 'string') {
        console.warn('[loginWindow] KingsChat denied or returned error:', data);
        reject(new KingsChatPopupError('denied', 'KingsChat sign-in was cancelled or refused.'));
      } else {
        resolve({
          accessToken: data.accessToken,
          refreshToken: String(data.refreshToken ?? ''),
          expiresInMillis: Number(data.expiresInMillis ?? 0),
        });
      }
    };

    const poll = setInterval(() => {
      try {
        if (popup.closed) {
          finish();
          reject(new KingsChatPopupError('closed', 'The KingsChat window was closed.'));
        }
      } catch {}
    }, 350);

    // Failsafe timeout to prevent button spinner from hanging indefinitely
    const timeout = setTimeout(() => {
      finish();
      reject(new KingsChatPopupError('closed', 'KingsChat sign-in timed out.'));
    }, 120000);

    window.addEventListener('message', onMessage);
    window.addEventListener('kingschat:closed', onClosed);
  });
}
