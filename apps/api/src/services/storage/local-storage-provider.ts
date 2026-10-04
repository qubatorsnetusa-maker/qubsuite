import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomToken } from '../../utils/crypto';
import { assertValidKey, type ByteRange, type StorageProvider, type StoredObject } from './storage-provider';

/** Stores objects on the local filesystem. Intended for development and single-node deployments. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private resolve(key: string): string {
    assertValidKey(key);
    const full = path.resolve(this.root, ...key.split('/'));
    if (!full.startsWith(this.root + path.sep)) throw new Error('Storage key escapes storage root');
    return full;
  }

  async put(key: string, body: Readable): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // Write to a temp file and rename so readers never see partial objects.
    const tmp = `${target}.${randomToken(6)}.part`;
    try {
      await pipeline(body, createWriteStream(tmp, { flags: 'wx' }));
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }

  async get(key: string, range?: ByteRange): Promise<StoredObject> {
    const file = this.resolve(key);
    const stat = await fs.stat(file);
    const stream = range ? createReadStream(file, { start: range.start, end: range.end }) : createReadStream(file);
    return { stream, size: stat.size };
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await fs.stat(this.resolve(key))).size;
    } catch {
      return null;
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    const target = this.resolve(targetKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(this.resolve(sourceKey), target);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async healthy(): Promise<boolean> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      await fs.access(this.root);
      return true;
    } catch {
      return false;
    }
  }
}
