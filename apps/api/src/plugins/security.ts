import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { isAllowedOrigin, type Env } from '../config/env';

export const securityPlugin = fp(async (app: FastifyInstance, opts: { env: Env }) => {
  const { env } = opts;

  await app.register(helmet, {
    // The API only serves JSON and file bytes; a strict CSP prevents any served content from running scripts.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        styleSrc: ["'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: env.isProduction,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin and non-browser requests have no Origin header.
      if (isAllowedOrigin(origin, env)) cb(null, true);
      else cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges'],
    maxAge: 600,
  });

  await app.register(cookie, { hook: 'onRequest' });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // Authenticated users are limited per user, anonymous traffic per IP.
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      return auth?.startsWith('Bearer ') ? `u:${auth.slice(-24)}` : `ip:${req.ip}`;
    },
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      success: false,
      error: { code: 'RATE_LIMITED', message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)}s.` },
    }),
  });
});
