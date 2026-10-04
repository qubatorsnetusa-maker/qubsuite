import { socketUrl } from './api';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'offline';

export interface ReconnectingSocketOptions<In> {
  path: string;
  onMessage(message: In): void;
  onState?(state: ConnectionState): void;
  /** Called on every successful (re)connect, e.g. to resend queued operations. */
  onOpen?(): void;
  /** Close codes after which the client must not retry (no access / not found). */
  onFatal?(code: number, reason: string): void;
}

const FATAL_CODES = new Set([4403, 4404]);

/**
 * JSON WebSocket with exponential backoff, online/offline awareness, keepalive pings and a fresh auth token on
 * every reconnect.
 */
export class ReconnectingSocket<In, Out> {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  state: ConnectionState = 'connecting';

  constructor(private readonly opts: ReconnectingSocketOptions<In>) {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.connect();
  }

  private setState(state: ConnectionState) {
    this.state = state;
    this.opts.onState?.(state);
  }

  private handleOnline = () => {
    if (this.state !== 'open') {
      this.attempts = 0;
      void this.connect();
    }
  };

  private handleOffline = () => {
    this.setState('offline');
    this.ws?.close();
  };

  private async connect() {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.setState(navigator.onLine ? 'connecting' : 'offline');
    let url: string;
    try {
      url = await socketUrl(this.opts.path);
    } catch {
      this.schedule();
      return;
    }
    if (this.stopped) return;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.setState('open');
      this.ping = setInterval(() => this.send({ type: 'ping' } as Out), 25_000);
      this.opts.onOpen?.();
    };
    ws.onmessage = (e) => {
      try {
        this.opts.onMessage(JSON.parse(e.data as string) as In);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = (e) => {
      if (this.ping) clearInterval(this.ping);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      if (FATAL_CODES.has(e.code)) {
        this.setState('closed');
        this.opts.onFatal?.(e.code, e.reason);
        return;
      }
      this.setState(navigator.onLine ? 'closed' : 'offline');
      this.schedule();
    };
  }

  private schedule() {
    if (this.stopped) return;
    const delay = Math.min(15_000, 500 * 2 ** this.attempts) + Math.random() * 300;
    this.attempts++;
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  send(message: Out): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  close() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.ping) clearInterval(this.ping);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.ws?.close();
  }
}
