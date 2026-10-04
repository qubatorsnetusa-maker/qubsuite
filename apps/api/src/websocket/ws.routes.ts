import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { authenticateSocket, closeForError, CLOSE_NOT_FOUND, heartbeat } from './socket-utils';

const uuid = z.uuid();
const MAX_BUFFERED_FRAMES = 200;

type Join = (socket: WebSocket, userId: string) => Promise<void>;

/**
 * Authenticates, then joins. Clients (e.g. y-websocket) send their first sync frames immediately on open,
 * while authentication and room loading are still async — frames are buffered and replayed after joining
 * so none are lost.
 */
async function accept(app: FastifyInstance, socket: WebSocket, request: FastifyRequest, join: Join): Promise<void> {
  const stop = heartbeat(socket);
  socket.on('close', stop);
  const buffered: [unknown, boolean][] = [];
  const buffer = (data: unknown, isBinary: boolean) => {
    if (buffered.length < MAX_BUFFERED_FRAMES) buffered.push([data, isBinary]);
  };
  socket.on('message', buffer);
  const auth = await authenticateSocket(app, request, socket);
  if (!auth) return;
  request.auth = auth;
  try {
    await join(socket, auth.userId);
  } catch (err) {
    closeForError(socket, err);
    return;
  } finally {
    socket.off('message', buffer);
  }
  for (const [data, isBinary] of buffered) socket.emit('message', data, isBinary);
}

/**
 * WebSocket endpoints, one room per resource (document:{id}, spreadsheet:{id}, form:{id}) plus a per-user
 * notification channel. Joining a room always re-checks the user's permission on the underlying Drive file.
 */
export async function wsRoutes(app: FastifyInstance) {
  const { realtime } = app.services;

  const room = (param: string, connect: (socket: WebSocket, userId: string, id: string) => Promise<void>) => async (socket: WebSocket, request: FastifyRequest) => {
    const id = (request.params as Record<string, string>)[param];
    if (!id || !uuid.safeParse(id).success) {
      socket.close(CLOSE_NOT_FOUND, 'Not found');
      return;
    }
    await accept(app, socket, request, (s, userId) => connect(s, userId, id));
  };

  app.get('/docs/:documentId', { websocket: true }, room('documentId', (s, u, id) => realtime.docs.connect(s, u, id)));
  app.get('/sheets/:spreadsheetId', { websocket: true }, room('spreadsheetId', (s, u, id) => realtime.sheets.connect(s, u, id)));
  app.get('/forms/:formId', { websocket: true }, room('formId', (s, u, id) => realtime.forms.connect(s, u, id)));
  app.get('/notifications', { websocket: true }, (socket, request) => accept(app, socket, request, (s, userId) => realtime.notifications.connect(s, userId)));
}
