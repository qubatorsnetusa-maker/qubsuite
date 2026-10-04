import { emailSchema, isPlaceholderEmail, type KingsChatEnvironment } from '@qub/shared';
import { AppError } from '../../utils/errors';

/** KingsChat's "who is this token for" endpoint, per deployment. */
export const KINGSCHAT_PROFILE_URLS: Record<KingsChatEnvironment, string> = {
  prod: 'https://connect.kingsch.at/api/profile',
  staging: 'https://kc-connect.appunite.com/api/profile',
  dev: 'http://localhost:8000/api/profile',
};

export interface KingsChatProfile {
  /** Stable KingsChat user id; the only thing a returning user is matched on. */
  userId: string;
  username: string | null;
  name: string | null;
  /** Lower-cased, valid, non-placeholder address, or null. Not verified by Qub. */
  email: string | null;
}

interface RawProfile {
  user?: { user_id?: unknown; name?: unknown; username?: unknown };
  email?: unknown;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

const failed = () => new AppError('UNAUTHENTICATED', 'KingsChat sign-in failed. Please try again.');
const unavailable = () => new AppError('UPSTREAM_UNAVAILABLE', 'KingsChat is unavailable right now. Please try again.');

/** Verifies a KingsChat access token by asking KingsChat whose it is. Never trusts profile data from the browser. */
export class KingsChatClient {
  constructor(
    private readonly environment: KingsChatEnvironment,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async fetchProfile(accessToken: string): Promise<KingsChatProfile> {
    let res: Response;
    const url = KINGSCHAT_PROFILE_URLS[this.environment];
    try {
      res = await this.fetchImpl(url, {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (networkErr) {
      console.error('[KingsChatClient] Network error fetching profile:', networkErr);
      throw unavailable();
    }
    console.log('[KingsChatClient] Response status:', res.status, 'from', url);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[KingsChatClient] Upstream returned error:', res.status, errText);
      if (res.status === 401 || res.status === 403) throw failed();
      throw res.status >= 500 ? unavailable() : failed();
    }
    let body: { profile?: RawProfile } & RawProfile;
    try {
      body = (await res.json()) as typeof body;
    } catch {
      throw unavailable();
    }
    const raw: RawProfile = body.profile ?? body;
    const userId = text(raw.user?.user_id);
    if (!userId) throw failed();
    const rawEmail = typeof raw.email === 'object' && raw.email !== null ? (raw.email as { address?: unknown }).address : raw.email;
    const parsed = emailSchema.safeParse(rawEmail);
    const email = parsed.success && !isPlaceholderEmail(parsed.data) ? parsed.data : null;
    return { userId, username: text(raw.user?.username), name: text(raw.user?.name), email };
  }
}
