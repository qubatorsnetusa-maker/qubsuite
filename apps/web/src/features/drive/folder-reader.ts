/** A file picked or dropped for upload, with the folder path it came from ("" for loose files). */
export interface UploadEntry {
  file: File;
  dir: string;
}

export interface UploadSelection {
  entries: UploadEntry[];
  /** Every folder path to create, including empty ones ("Trip", "Trip/Photos"). */
  dirs: string[];
}

/** From an `<input webkitdirectory>` or a plain multi-file input. */
export function selectionFromFileList(list: FileList | File[]): UploadSelection {
  const entries = Array.from(list).map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    return { file, dir: rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '' };
  });
  return { entries, dirs: [...new Set(entries.map((e) => e.dir).filter(Boolean))] };
}

type FsEntry = FileSystemEntry;

function readAll(dir: FileSystemDirectoryEntry): Promise<FsEntry[]> {
  const reader = dir.createReader();
  const out: FsEntry[] = [];
  // readEntries returns results in batches (about 100 in Chromium) until it returns an empty batch.
  return new Promise((resolve, reject) => {
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(out);
        out.push(...batch);
        next();
      }, reject);
    next();
  });
}

const fileOf = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walk(entry: FsEntry, dir: string, sel: UploadSelection): Promise<void> {
  if (entry.isFile) {
    sel.entries.push({ file: await fileOf(entry as FileSystemFileEntry), dir });
    return;
  }
  if (entry.isDirectory) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    sel.dirs.push(path);
    for (const child of await readAll(entry as FileSystemDirectoryEntry)) await walk(child, path, sel);
  }
}

/**
 * Reads a drop, including dropped folders. Entries must be taken from the DataTransfer synchronously, inside the
 * drop event; the folders are then read asynchronously.
 */
export function selectionFromDrop(dt: DataTransfer): Promise<UploadSelection> {
  const roots = Array.from(dt.items)
    .filter((i) => i.kind === 'file')
    .map((i) => i.webkitGetAsEntry?.() ?? null);
  const files = Array.from(dt.files);
  if (!roots.some((e) => e?.isDirectory)) return Promise.resolve({ entries: files.map((file) => ({ file, dir: '' })), dirs: [] });
  return (async () => {
    const sel: UploadSelection = { entries: [], dirs: [] };
    for (const root of roots) if (root) await walk(root, '', sel);
    return sel;
  })();
}
