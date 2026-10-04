import type { NativeFileType } from '@qub/shared';
import type { Executor } from '../../db';

/**
 * Hooks through which Docs/Sheets/Forms plug their resource-specific behaviour into generic Drive operations,
 * so copy and permanent delete work the same way for every file type (Drive stays the single file service).
 */
export interface NativeResourceHandler {
  /** Copies the resource backing `sourceFileId` onto the freshly created `targetFileId`. */
  copy(tx: Executor, sourceFileId: string, targetFileId: string, userId: string): Promise<void>;
  /** Storage objects owned by the resources (e.g. form uploads) that must be deleted with the files. */
  storageKeys?(tx: Executor, fileIds: string[]): Promise<string[]>;
}

export class NativeResourceRegistry {
  private readonly handlers = new Map<NativeFileType, NativeResourceHandler>();

  register(type: NativeFileType, handler: NativeResourceHandler): void {
    this.handlers.set(type, handler);
  }

  get(type: NativeFileType): NativeResourceHandler {
    const h = this.handlers.get(type);
    if (!h) throw new Error(`No handler registered for ${type}`);
    return h;
  }

  async storageKeys(tx: Executor, fileIds: string[]): Promise<string[]> {
    if (!fileIds.length) return [];
    const keys: string[] = [];
    for (const h of this.handlers.values()) if (h.storageKeys) keys.push(...(await h.storageKeys(tx, fileIds)));
    return keys;
  }
}
