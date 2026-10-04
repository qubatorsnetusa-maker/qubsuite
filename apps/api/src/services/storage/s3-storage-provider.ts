import type { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { assertValidKey, type ByteRange, type StorageProvider, type StoredObject } from './storage-provider';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  /** Custom endpoint for R2, MinIO and other S3-compatible services. */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/** Works with AWS S3 and S3-compatible providers (Cloudflare R2, MinIO, Wasabi, Backblaze B2, ...). */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    });
  }

  async put(key: string, body: Readable, options: { contentType: string }): Promise<void> {
    assertValidKey(key);
    // Multipart upload streams without buffering the whole object in memory.
    await new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: options.contentType },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    }).done();
  }

  async get(key: string, range?: ByteRange): Promise<StoredObject> {
    assertValidKey(key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
    );
    const total = res.ContentRange ? Number(res.ContentRange.split('/')[1]) : Number(res.ContentLength ?? 0);
    return { stream: res.Body as Readable, size: total };
  }

  async size(key: string): Promise<number | null> {
    assertValidKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return Number(res.ContentLength ?? 0);
    } catch {
      return null;
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    assertValidKey(sourceKey);
    assertValidKey(targetKey);
    await this.client.send(
      new CopyObjectCommand({ Bucket: this.bucket, Key: targetKey, CopySource: `${this.bucket}/${encodeURIComponent(sourceKey)}` }),
    );
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async healthy(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
