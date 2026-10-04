import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import type { FastifyBaseLogger } from 'fastify';
import { AppError } from '../../utils/errors';
import { isBlocked, resolveMime } from '../../utils/mime';
import type { ByteRange, StorageProvider, StoredObject } from './storage-provider';

export interface IngestOptions {
  filename: string;
  key: string;
  maxBytes: number;
  /** Error raised when the stream passes `maxBytes` (e.g. a storage quota rather than the file-size limit). */
  limitError?: () => AppError;
  /** Extra lowercase extensions (".exe") to reject, on top of the built-in executable list. */
  blockedExtensions?: readonly string[];
}

export interface IngestResult {
  key: string;
  size: number;
  checksum: string;
  mimeType: string;
}

const SNIFF_BYTES = 4100;

/** Reads the first `n` bytes of a stream without losing them. */
async function peek(stream: Readable, n: number): Promise<{ head: Buffer; rest: Readable }> {
  const it = stream[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  const chunks: Buffer[] = [];
  let length = 0;
  let done = false;
  while (length < n) {
    const r = await it.next();
    if (r.done) {
      done = true;
      break;
    }
    chunks.push(r.value);
    length += r.value.length;
  }
  const head = Buffer.concat(chunks);
  async function* replay() {
    if (head.length) yield head;
    if (done) return;
    for (;;) {
      const r = await it.next();
      if (r.done) return;
      yield r.value;
    }
  }
  return { head, rest: Readable.from(replay(), { objectMode: false }) };
}

/** Counts bytes, hashes content and enforces the size limit while streaming. */
class MeterTransform extends Transform {
  readonly hash = createHash('sha256');
  bytes = 0;
  constructor(
    private readonly maxBytes: number,
    private readonly limitError?: () => AppError,
  ) {
    super();
  }
  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null, data?: Buffer) => void) {
    this.bytes += chunk.length;
    if (this.bytes > this.maxBytes) {
      cb(this.limitError?.() ?? new AppError('PAYLOAD_TOO_LARGE', `File exceeds the maximum size of ${Math.floor(this.maxBytes / 1024 / 1024)} MB.`));
      return;
    }
    this.hash.update(chunk);
    cb(null, chunk);
  }
}

export class StorageService {
  constructor(
    readonly provider: StorageProvider,
    private readonly log: FastifyBaseLogger,
  ) {}

  newKey(prefix: 'files' | 'forms' | 'avatars' | 'copies', scopeId: string): string {
    const now = new Date();
    const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return `${prefix}/${scopeId.toLowerCase()}/${month}/${randomUUID()}`;
  }

  /**
   * Streams an upload into object storage. The MIME type comes from magic-byte sniffing (never the client),
   * size is enforced while streaming, and a SHA-256 checksum is computed on the fly.
   */
  async ingest(source: Readable, options: IngestOptions): Promise<IngestResult> {
    const { head, rest } = await peek(source, SNIFF_BYTES);
    const sniffed = await fileTypeFromBuffer(head);
    const mimeType = resolveMime(sniffed?.mime, options.filename, head);
    if (isBlocked(mimeType, options.filename)) {
      source.resume();
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Executable files are not allowed.');
    }
    const ext = path.extname(options.filename).toLowerCase();
    if (ext && options.blockedExtensions?.includes(ext)) {
      source.resume();
      throw new AppError('POLICY_VIOLATION', `Your organization doesn't allow uploading ${ext} files.`);
    }
    if (options.maxBytes <= 0) {
      source.resume();
      throw options.limitError?.() ?? new AppError('PAYLOAD_TOO_LARGE', 'File exceeds the maximum upload size.');
    }
    const meter = new MeterTransform(options.maxBytes, options.limitError);
    // The limit can trip on the very first chunk, before the provider subscribes; keep the error rather than
    // letting it surface as unhandled, and report it in preference to the provider's generic stream error.
    let meterError: unknown = null;
    meter.on('error', (err) => {
      meterError ??= err;
    });
    const metered = rest.pipe(meter);
    rest.on('error', (err) => meter.destroy(err));
    try {
      await this.provider.put(options.key, metered, { contentType: mimeType });
    } catch (err) {
      await this.safeDelete(options.key);
      if (meterError instanceof AppError) throw meterError;
      if (err instanceof AppError) throw err;
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new AppError('PAYLOAD_TOO_LARGE', 'File exceeds the maximum upload size.');
      }
      throw err;
    }
    return { key: options.key, size: meter.bytes, checksum: meter.hash.digest('hex'), mimeType };
  }

  get(key: string, range?: ByteRange): Promise<StoredObject> {
    return this.provider.get(key, range);
  }

  copy(sourceKey: string, targetKey: string): Promise<void> {
    return this.provider.copy(sourceKey, targetKey);
  }

  /** Deletes objects after the database commit; failures are logged, never thrown (the purge job can retry orphans). */
  async safeDelete(...keys: (string | null | undefined)[]): Promise<void> {
    const present = keys.filter((k): k is string => !!k);
    // An uploaded file's cached thumbnail (see ThumbnailService) goes with it.
    const thumbnails = present.filter((k) => k.startsWith('files/') || k.startsWith('copies/')).map((k) => `thumbnails/${k}`);
    const unique = [...new Set([...present, ...thumbnails])];
    await Promise.all(
      unique.map(async (key) => {
        try {
          await this.provider.delete(key);
        } catch (err) {
          this.log.warn({ err, key }, 'Failed to delete storage object');
        }
      }),
    );
  }
}
