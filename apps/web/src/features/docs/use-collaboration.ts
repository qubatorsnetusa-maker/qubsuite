import { DOC_MESSAGE_SAVE_STATUS, type DocSaveStatus, type Role } from '@qub/shared';
import * as decoding from 'lib0/decoding';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { authStore } from '@/lib/auth-store';

const MSG_IDENTITY = 101;
const MSG_COMMENTS_CHANGED = 102;

export type SaveState = 'saved' | 'saving' | 'offline' | 'connection-lost' | 'error';

export interface CollabUser {
  clientId: number;
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
}

/**
 * Real-time collaboration for one document:
 *  - Y.Doc synced over WebSocket (y-websocket protocol) with the Fastify room
 *  - IndexedDB persistence so edits made offline survive reloads and sync on reconnect
 *  - save status derived from server persistence acknowledgements (not from keystrokes)
 */
export function useCollaboration(documentId: string, onCommentsChanged: () => void) {
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const lastLocalEdit = useRef(0);
  const pending = useRef(false);
  const commentsCb = useRef(onCommentsChanged);
  commentsCb.current = onCommentsChanged;

  useEffect(() => {
    let disposed = false;
    const local = new IndexeddbPersistence(`qub-doc-${documentId}`, ydoc);
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const p = new WebsocketProvider(`${proto}//${window.location.host}/api/ws/docs`, documentId, ydoc, {
      connect: false,
      params: { token: '' },
      maxBackoffTime: 10_000,
    });

    p.messageHandlers[DOC_MESSAGE_SAVE_STATUS] = (_enc, dec) => {
      const status = JSON.parse(decoding.readVarString(dec)) as DocSaveStatus;
      if (status.status === 'error') return setSaveState('error');
      setLastSavedAt(status.savedAt);
      // Edits in the last moments may not be part of this save; another acknowledgement will follow.
      if (Date.now() - lastLocalEdit.current > 1200) {
        pending.current = false;
        setSaveState('saved');
      }
    };
    p.messageHandlers[MSG_IDENTITY] = (_enc, dec) => {
      const identity = JSON.parse(decoding.readVarString(dec)) as { userId: string; role: Role };
      setRole(identity.role);
    };
    p.messageHandlers[MSG_COMMENTS_CHANGED] = () => commentsCb.current();

    p.on('status', ({ status }) => {
      setConnected(status === 'connected');
      if (status === 'disconnected') setSaveState(navigator.onLine ? 'connection-lost' : 'offline');
      if (status === 'connected') setSaveState(pending.current ? 'saving' : 'saved');
    });
    p.on('sync', (s: boolean) => setSynced(s));
    p.on('connection-close', (event) => {
      // An expired token closes with 4401 (not retried by y-websocket): refresh it and reconnect.
      if (event?.code === 4401 && !disposed) {
        void authStore.refresh().then((ok) => {
          if (ok && !disposed) {
            p.params.token = authStore.get().accessToken ?? '';
            p.connect();
          }
        });
      } else if (event && (event.code === 4403 || event.code === 4404)) {
        setFatal(event.code === 4403 ? 'Your access to this document was removed.' : 'This document no longer exists or you lost access.');
      }
    });

    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === p || origin === local) return;
      lastLocalEdit.current = Date.now();
      pending.current = true;
      setSaveState(p.wsconnected ? 'saving' : navigator.onLine ? 'connection-lost' : 'offline');
    };
    ydoc.on('update', onUpdate);

    const awarenessChange = () => {
      const list: CollabUser[] = [];
      p.awareness.getStates().forEach((state, clientId) => {
        const u = (state as { user?: Omit<CollabUser, 'clientId'> }).user;
        if (u && clientId !== ydoc.clientID) list.push({ clientId, ...u });
      });
      setUsers(list);
    };
    p.awareness.on('change', awarenessChange);

    // Keep the socket token fresh (it is read on every reconnect).
    const refreshToken = async () => {
      const token = await authStore.validToken();
      if (token) p.params.token = token;
    };
    const tokenTimer = setInterval(() => void refreshToken(), 60_000);
    void refreshToken().then(() => {
      if (!disposed) p.connect();
    });
    const onOffline = () => setSaveState('offline');
    window.addEventListener('offline', onOffline);
    setProvider(p);

    return () => {
      disposed = true;
      clearInterval(tokenTimer);
      window.removeEventListener('offline', onOffline);
      ydoc.off('update', onUpdate);
      p.awareness.off('change', awarenessChange);
      p.destroy();
      void local.destroy();
      setProvider(null);
    };
  }, [documentId, ydoc]);

  useEffect(() => () => ydoc.destroy(), [ydoc]);

  return { ydoc, provider, connected, synced, saveState, lastSavedAt, role, users, fatal };
}
