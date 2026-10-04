import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { AuthContext } from '../plugins/auth';
import { AppError } from '../utils/errors';

export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_FORBIDDEN = 4403;
export const CLOSE_NOT_FOUND = 4404;
export const CLOSE_SERVER_ERROR = 4500;

/**
 * Browsers cannot set headers on WebSocket upgrades, so the access token travels as a query parameter.
 * It is short-lived, never logged (query strings are stripped from logs), and verified exactly like a bearer token.
 */
export async function authenticateSocket(app: FastifyInstance, request: FastifyRequest, socket: WebSocket): Promise<AuthContext | null> {
  const token = (request.query as Record<string, string | undefined>).token;
  if (!token) {
    socket.close(CLOSE_UNAUTHORIZED, 'Authentication required');
    return null;
  }
  try {
    return await app.verifyAccessToken(token);
  } catch {
    socket.close(CLOSE_UNAUTHORIZED, 'Invalid or expired token');
    return null;
  }
}

/** Maps service errors to close codes so clients can distinguish "no access" from transient failures. */
export function closeForError(socket: WebSocket, err: unknown): void {
  if (err instanceof AppError) {
    const code = err.statusCode === 404 ? CLOSE_NOT_FOUND : err.statusCode === 403 ? CLOSE_FORBIDDEN : err.statusCode === 401 ? CLOSE_UNAUTHORIZED : CLOSE_SERVER_ERROR;
    socket.close(code, err.message.slice(0, 120));
  } else {
    socket.close(CLOSE_SERVER_ERROR, 'Server error');
  }
}

/** Terminates sockets that stop answering pings (dead TCP connections, sleeping laptops). */
export function heartbeat(socket: WebSocket, intervalMs = 30_000): () => void {
  let alive = true;
  socket.on('pong', () => {
    alive = true;
  });
  const timer = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    try {
      socket.ping();
    } catch {
      socket.terminate();
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

export function sendJson(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}
