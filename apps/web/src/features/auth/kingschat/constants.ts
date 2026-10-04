import type { KingsChatEnvironment } from '@qub/shared';

/** Where the KingsChat consent popup lives, per deployment. Its origin is also the only accepted postMessage sender. */
export const KINGSCHAT_ACCOUNTS_URLS: Record<KingsChatEnvironment, string> = {
  prod: 'https://accounts.kingsch.at',
  staging: 'https://accounts.staging.kingsch.at',
  dev: 'http://localhost:5050',
};
