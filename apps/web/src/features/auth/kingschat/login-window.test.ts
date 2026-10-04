import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KingsChatPopupError, kingslogin } from './index';

const ORIGIN = 'https://accounts.kingsch.at';
let popup: { closed: boolean; close: ReturnType<typeof vi.fn> };
let opened: string | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  const own = { closed: false, close: vi.fn(() => void (own.closed = true)) };
  popup = own;
  vi.spyOn(window, 'open').mockImplementation((url) => {
    opened = String(url);
    return popup as unknown as Window;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const post = (origin: string, data: unknown) => window.dispatchEvent(new MessageEvent('message', { origin, data }));

describe('kingslogin', () => {
  it('opens the KingsChat popup with the client id, profile scope and this origin', () => {
    void kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    const url = new URL(opened!);
    expect(url.origin).toBe(ORIGIN);
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('scopes')).toBe('["profile"]');
    expect(url.searchParams.get('redirect_uri')).toBe(window.location.origin);
    expect(url.searchParams.get('post_message')).toBe('1');
  });

  it('resolves with the tokens KingsChat posts back and closes the popup', async () => {
    const p = kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    post(ORIGIN, { accessToken: 'a', refreshToken: 'r', expiresInMillis: 1000 });
    await expect(p).resolves.toEqual({ accessToken: 'a', refreshToken: 'r', expiresInMillis: 1000 });
    expect(popup.close).toHaveBeenCalled();
  });

  it('ignores messages from other origins instead of failing', async () => {
    const p = kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    post('https://evil.example', { accessToken: 'stolen' });
    post(ORIGIN, { accessToken: 'a', refreshToken: 'r', expiresInMillis: 1 });
    await expect(p).resolves.toMatchObject({ accessToken: 'a' });
  });

  it('rejects with reason "denied" when KingsChat reports an error', async () => {
    const p = kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    post(ORIGIN, { error: 'access_denied' });
    await expect(p).rejects.toMatchObject({ reason: 'denied' });
    expect(popup.close).toHaveBeenCalled();
  });

  it('rejects with reason "closed" when the user closes the popup', async () => {
    const p = kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    const settled = p.catch((e: unknown) => e);
    popup.closed = true;
    vi.advanceTimersByTime(400);
    const err = await settled;
    expect(err).toBeInstanceOf(KingsChatPopupError);
    expect(err).toMatchObject({ reason: 'closed' });
  });

  it('rejects with reason "blocked" when the browser blocks the popup', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null);
    await expect(kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod')).rejects.toMatchObject({ reason: 'blocked' });
  });

  it('stops listening once settled', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const p = kingslogin({ clientId: 'cid', scopes: ['profile'] }, 'prod');
    post(ORIGIN, { accessToken: 'a', refreshToken: 'r', expiresInMillis: 1 });
    await p;
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
