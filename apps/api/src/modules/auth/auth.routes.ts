import {
  addEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  kingschatLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type AuthProviders,
} from '@qub/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { auditContext, ok } from '../../http/respond';
import { MEDIA_COOKIE, MEDIA_TOKEN_TTL_SECONDS, REFRESH_COOKIE, requireAuth } from '../../plugins/auth';
import { AppError, forbidden } from '../../utils/errors';
import { UserRepository } from '../users/user.repository';
import type { IssuedSession } from './auth.service';

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { auth } = app.services;
  const env = app.services.env;
  const authLimit = { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } };

  const client = (request: FastifyRequest) => ({ ...auditContext(request), actorId: null });
  /** With COOKIE_DOMAIN, one sign-in covers every sibling site (drive., docs., …) that proxies to this API. */
  const domain = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};

  function setSessionCookies(reply: FastifyReply, session: IssuedSession) {
    // The refresh token is only ever sent to /api/auth, is invisible to JavaScript, and never cross-site.
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: (env.COOKIE_DOMAIN ? 'lax' : 'strict') as const,
      path: '/api/auth',
      expires: session.refreshTokenExpiresAt,
      ...domain,
    });
    setMediaCookie(reply, session.user.id, session.sessionId);
  }

  function setMediaCookie(reply: FastifyReply, userId: string, sessionId: string) {
    reply.setCookie(MEDIA_COOKIE, app.signMediaToken(userId, sessionId), {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      path: '/api/',
      maxAge: MEDIA_TOKEN_TTL_SECONDS,
      ...domain,
    });
  }

  function clearCookies(reply: FastifyReply) {
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth', ...domain });
    reply.clearCookie(MEDIA_COOKIE, { path: '/api/', ...domain });
  }

  /** CSRF defence for cookie-authenticated endpoints: the Origin (when sent) must be an allowed app origin. */
  function assertSameOrigin(request: FastifyRequest) {
    const origin = request.headers.origin;
    if (origin && !env.corsOrigins.includes(origin)) throw forbidden('Cross-site request rejected.');
  }

  const publicSession = (s: IssuedSession) => ({
    accessToken: s.accessToken,
    accessTokenExpiresAt: s.accessTokenExpiresAt,
    refreshToken: s.refreshToken,
    user: s.user,
  });

  r.post('/register', { config: authLimit, schema: { body: registerSchema } }, async (request, reply) => {
    const result = await auth.register(request.body, client(request));
    if ('requiresVerification' in result) return reply.code(201).send(ok(result));
    setSessionCookies(reply, result);
    return reply.code(201).send(ok(publicSession(result)));
  });

  r.post('/login', { config: authLimit, schema: { body: loginSchema } }, async (request, reply) => {
    const session = await auth.login(request.body, client(request));
    setSessionCookies(reply, session);
    return ok(publicSession(session));
  });

  r.get('/providers', async () => {
    const providers: AuthProviders = {
      kingschat: env.KINGSCHAT_CLIENT_ID ? { clientId: env.KINGSCHAT_CLIENT_ID, environment: env.KINGSCHAT_ENV } : null,
    };
    return ok(providers);
  });

  r.post('/kingschat', { config: authLimit, schema: { body: kingschatLoginSchema } }, async (request, reply) => {
    const session = await auth.kingschatSignIn(request.body.accessToken, client(request));
    setSessionCookies(reply, session);
    return ok(publicSession(session));
  });

  r.post('/refresh', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    assertSameOrigin(request);
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) throw new AppError('UNAUTHENTICATED', 'No active session.');
    try {
      const session = await auth.refresh(token, client(request));
      setSessionCookies(reply, session);
      return ok(publicSession(session));
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 401) clearCookies(reply);
      throw err;
    }
  });

  r.post('/verify-token', { config: authLimit, schema: { body: z.object({ token: z.string().min(1) }) } }, async (request, reply) => {
    try {
      const authCtx = await app.verifyAccessToken(request.body.token);
      return reply.send({
        valid: true,
        user: {
          id: authCtx.userId,
          username: authCtx.name,
          email: authCtx.email,
          roles: [authCtx.platformRole],
          display_name: authCtx.name,
        },
      });
    } catch {
      return reply.send({
        valid: false,
        error: 'Invalid or expired token',
      });
    }
  });

  r.post('/refresh-token', { config: authLimit, schema: { body: z.object({ refresh_token: z.string().min(1) }) } }, async (request, reply) => {
    try {
      const session = await auth.refresh(request.body.refresh_token, client(request));
      setSessionCookies(reply, session);
      return reply.send({
        access_token: session.accessToken,
        accessToken: session.accessToken,
        refresh_token: session.refreshToken,
        refreshToken: session.refreshToken,
        user: session.user,
      });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 401) clearCookies(reply);
      throw err;
    }
  });

  r.post('/logout', async (request, reply) => {
    assertSameOrigin(request);
    let sessionId: string | undefined;
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        sessionId = (await app.verifyAccessToken(header.slice(7))).sessionId;
      } catch {
        // fall back to the cookie
      }
    }
    await auth.logout(request.cookies[REFRESH_COOKIE], sessionId, client(request));
    clearCookies(reply);
    return ok({ loggedOut: true });
  });

  r.post('/logout-all', { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireAuth(request);
    await auth.revokeAllSessions(user.userId, 'logout_all');
    await app.services.audit.log(auditContext(request), 'auth.logout_all', { type: 'user', id: user.userId });
    clearCookies(reply);
    return ok({ loggedOut: true });
  });

  /** Renews the media cookie used by <img>/<video>/download links. */
  r.post('/media-session', { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireAuth(request);
    setMediaCookie(reply, user.userId, user.sessionId);
    return ok({ expiresIn: MEDIA_TOKEN_TTL_SECONDS });
  });

  r.post('/forgot-password', { config: authLimit, schema: { body: forgotPasswordSchema } }, async (request) => {
    await auth.forgotPassword(request.body.email, client(request));
    return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
  });

  r.post('/reset-password', { config: authLimit, schema: { body: resetPasswordSchema } }, async (request, reply) => {
    await auth.resetPassword(request.body.token, request.body.password, client(request));
    clearCookies(reply);
    return ok({ message: 'Password updated. Please sign in.' });
  });

  r.post('/verify-email', { config: authLimit, schema: { body: verifyEmailSchema } }, async (request) => {
    await auth.verifyEmail(request.body.token, client(request));
    return ok({ verified: true });
  });

  r.post('/resend-verification', { preHandler: app.authenticate, config: authLimit }, async (request) => {
    await auth.resendVerification(requireAuth(request).userId);
    return ok({ sent: true });
  });

  r.post('/change-password', { preHandler: app.authenticate, config: authLimit, schema: { body: changePasswordSchema } }, async (request) => {
    const user = requireAuth(request);
    await auth.changePassword(user.userId, user.sessionId, request.body, auditContext(request));
    return ok({ changed: true });
  });

  r.post('/add-email', { preHandler: app.authenticate, config: authLimit, schema: { body: addEmailSchema } }, async (request) => {
    await auth.addEmail(requireAuth(request).userId, request.body.email, auditContext(request));
    return ok({ sent: true });
  });

  r.get('/me', { preHandler: app.authenticate }, async (request) => {
    const user = await UserRepository.findById(app.services.db, requireAuth(request).userId);
    return ok(await UserRepository.toCurrentUser(app.services.db, user!));
  });

  r.get('/sessions', { preHandler: app.authenticate }, async (request) => {
    const user = requireAuth(request);
    return ok(await auth.listSessions(user.userId, user.sessionId));
  });

  r.delete('/sessions/:id', { preHandler: app.authenticate, schema: { params: z.object({ id: z.uuid() }) } }, async (request) => {
    await auth.revokeOwnSession(requireAuth(request).userId, request.params.id, auditContext(request));
    return ok({ revoked: true });
  });
}
