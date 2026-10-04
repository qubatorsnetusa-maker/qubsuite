import type { Readable } from 'node:stream';

export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

export interface StoredObject {
  stream: Readable;
  size: number;
}

/**
 * Object storage abstraction. Application code only talks to this interface, so switching between
 * local disk, AWS S3, Cloudflare R2, MinIO or another backend is a configuration change.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Readable, options: { contentType: string }): Promise<void>;
  get(key: string, range?: ByteRange): Promise<StoredObject>;
  size(key: string): Promise<number | null>;
  copy(sourceKey: string, targetKey: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Readiness probe. */
  healthy(): Promise<boolean>;
}

/** Storage keys are generated server-side; this guard rejects anything else (defence against path traversal). */
const KEY_RE = /^[a-z0-9][a-z0-9/_-]{0,511}$/;

export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('//') || key.split('/').some((seg) => seg === '..' || seg === '.')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
