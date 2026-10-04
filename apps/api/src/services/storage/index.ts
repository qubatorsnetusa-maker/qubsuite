import type { Env } from '../../config/env';
import { LocalStorageProvider } from './local-storage-provider';
import { S3StorageProvider } from './s3-storage-provider';
import type { StorageProvider } from './storage-provider';

export function createStorageProvider(env: Env): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 's3':
      return new S3StorageProvider({
        bucket: env.STORAGE_BUCKET!,
        region: env.STORAGE_REGION,
        endpoint: env.STORAGE_ENDPOINT,
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
        forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      });
    case 'local':
      return new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
  }
}

export * from './storage-provider';
export * from './storage.service';
export { LocalStorageProvider, S3StorageProvider };
