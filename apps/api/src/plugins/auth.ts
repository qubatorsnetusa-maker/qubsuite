import jwt from '@fastify/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { PlatformRole } from '@qub/shared';
import type { Env } from '../config/env';
import type { Database } from '../db';
import { sessions, users } from '../db/schema';
import { AppError, unauthenticated } from '../utils/errors';

export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
}

interface AccessClaims {
  sub: string;
  sid: string;
  typ: 'access';
}

interface MediaClaims {
  sub: string;
  sid: string;
  typ: 'media';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessClaims | MediaClaims | { typ: 'share'; lid: string };
  }
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Route serves media and accepts the media cookie as well as bearer tokens. */
    media?: boolean;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    /** preHandler: rejects unauthenticated requests. */
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** preHandler: authenticates when a token is present, otherwise continues anonymously. */
    optionalAuth: (request: FastifyRequest) => Promise<void>;
    /** Verifies an access token (used by WebSocket upgrades, where headers cannot be set by browsers). */
    verifyAccessToken: (token: string) => Promise<AuthContext>;
    /**
     * preHandler for read-only media endpoints (<img>, <video>, download links) where the browser cannot attach
     * a bearer token: accepts the bearer token or the session-bound `qub_media` cookie.
     */
    mediaAuth: (request: FastifyRequest) => Promise<void>;
    signMediaToken: (userId: string, sessionId: string) => string;
  }
}

export const REFRESH_COOKIE = 'qub_rt';
export const MEDIA_COOKIE = 'qub_media';
export const MEDIA_TOKEN_TTL_SECONDS = 60 * 60;

export const authPlugin = fp(async (app: FastifyInstance, opts: { env: Env; db: Database }) => {
  const { env, db } = opts;
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { algorithm: 'HS256' }, verify: { algorithms: ['HS256'] } });

  app.decorateRequest('auth', null);

  /** Validates the token, then the session (so logout/revocation takes effect immediately) and the account. */
  async function resolve(token: string, typ: 'access' | 'media' = 'access'): Promise<AuthContext> {
    let claims: AccessClaims | MediaClaims;
    try {
      claims = app.jwt.verify<AccessClaims | MediaClaims>(token);
    } catch (err) {
      const expired = (err as { code?: string }).code === 'FAST_JWT_EXPIRED';
      throw new AppError(expired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED', expired ? 'Access token expired.' : 'Invalid access token.');
    }
    if (claims.typ !== typ || !claims.sub || !claims.sid) throw unauthenticated('Invalid access token.');
    const [row] = await db
      .select({ userId: users.id, email: users.email, name: users.name, status: users.status, platformRole: users.platformRole, sessionCreatedAt: sessions.createdAt })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, claims.sid), eq(sessions.userId, claims.sub), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row || row.status !== 'ACTIVE') throw unauthenticated('Session is no longer valid.');
    // Organization session lifetime (admin console → Security): older sessions must sign in again.
    const maxHours = app.hasDecorator('services') ? (await app.services.policies.get()).security.sessionMaxHours : null;
    if (maxHours != null && row.sessionCreatedAt.getTime() + maxHours * 3_600_000 < Date.now()) {
      await db.update(sessions).set({ revokedAt: new Date(), revokeReason: 'max_age' }).where(and(eq(sessions.id, claims.sid), isNull(sessions.revokedAt)));
      throw unauthenticated('Your session has expired. Sign in again.');
    }
    return { userId: row.userId, sessionId: claims.sid, email: row.email, name: row.name, platformRole: row.platformRole };
  }

  function bearer(request: FastifyRequest): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
  }

  app.decorate('verifyAccessToken', (token: string) => resolve(token, 'access'));

  app.decorate('signMediaToken', (userId: string, sessionId: string) =>
    app.jwt.sign({ sub: userId, sid: sessionId, typ: 'media' }, { expiresIn: MEDIA_TOKEN_TTL_SECONDS }),
  );

  app.decorate('mediaAuth', async (request: FastifyRequest) => {
    const token = bearer(request);
    if (token) {
      request.auth = await resolve(token, 'access');
      return;
    }
    const media = request.cookies[MEDIA_COOKIE];
    if (!media) throw unauthenticated();
    request.auth = await resolve(media, 'media');
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const token = bearer(request);
    if (!token) throw unauthenticated();
    request.auth = await resolve(token);
  });

  app.decorate('optionalAuth', async (request: FastifyRequest) => {
    const token = bearer(request);
    if (!token) return;
    request.auth = await resolve(token);
  });
});

/** The authenticated user; only valid inside routes guarded by `app.authenticate`. */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthenticated();
  return request.auth;
}
