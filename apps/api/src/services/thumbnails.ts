import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import type { FastifyBaseLogger } from 'fastify';
import sharp from 'sharp';
import type { StorageService } from './storage';

/** Longest edge of a stored thumbnail: sharp on a high-density grid card, a fraction of the original's size. */
export const THUMBNAIL_WIDTH = 480;
/** Taller sources (portrait pages, phone screenshots) are cropped from the top to this height. */
const THUMBNAIL_MAX_HEIGHT = 640;

/** Raster formats sharp decodes. SVG is left out on purpose: rendering untrusted SVG server-side isn't worth the risk. */
const RASTER = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/tiff']);
const PDF = 'application/pdf';
/** Larger sources aren't worth decoding for a thumbnail (and would hold memory while doing it). */
const MAX_SOURCE_BYTES = { raster: 60 * 1024 * 1024, pdf: 100 * 1024 * 1024 };

export function supportsThumbnail(file: { mimeType: string; size: number; storageKey: string | null }): boolean {
  if (!file.storageKey || file.size <= 0) return false;
  if (RASTER.has(file.mimeType)) return file.size <= MAX_SOURCE_BYTES.raster;
  if (file.mimeType === PDF) return file.size <= MAX_SOURCE_BYTES.pdf;
  return false;
}

/** Thumbnails live next to the bytes they were made from, so a new version (a new storage key) gets a new one. */
export function thumbnailKey(storageKey: string): string {
  return `thumbnails/${storageKey}`;
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjs: Promise<{ lib: PdfJs; assets: string }> | null = null;
function loadPdfJs() {
  pdfjs ??= (async () => {
    const root = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
    return { lib: await import('pdfjs-dist/legacy/build/pdf.mjs'), assets: root };
  })();
  return pdfjs;
}

/** Renders a PDF's first page to PNG. Fonts are drawn from pdf.js's own data, so no system fonts are needed. */
async function renderPdfPage(data: Buffer): Promise<Buffer> {
  const { lib, assets } = await loadPdfJs();
  const dir = (name: string) => `${pathToFileURL(path.join(assets, name)).pathname.replace(/^\/([a-z]:)/i, '$1')}/`;
  const task = lib.getDocument({
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: dir('standard_fonts'),
    cMapUrl: dir('cmaps'),
    cMapPacked: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Render at twice the thumbnail width (downscaling keeps text crisp), capped for huge page sizes.
    const scale = Math.min(4, (THUMBNAIL_WIDTH * 2) / base.width);
    const viewport = page.getViewport({ scale });
    const height = Math.min(Math.ceil(viewport.height), Math.ceil(viewport.width * 3));
    const factory = (doc as unknown as { canvasFactory: { create(w: number, h: number): { canvas: { toBuffer(type: 'image/png'): Buffer }; context: unknown } } }).canvasFactory;
    const { canvas, context } = factory.create(Math.ceil(viewport.width), height);
    await page.render({ canvas: canvas as never, canvasContext: context as never, viewport, background: 'white' }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    await task.destroy();
  }
}

/**
 * Makes and caches thumbnails for uploaded images and PDFs. They're generated the first time someone views them
 * (so files uploaded before this existed get one too) and stored as WebP beside the original. A file that can't be
 * decoded gets an empty marker so it isn't retried on every listing.
 */
export class ThumbnailService {
  private readonly inFlight = new Map<string, Promise<Buffer | null>>();
  /** PDF rendering runs on the main thread, so it's done one at a time. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: StorageService,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** The thumbnail's WebP bytes, or null when the file has none. */
  async get(file: { storageKey: string | null; mimeType: string; size: number }): Promise<Buffer | null> {
    if (!supportsThumbnail(file)) return null;
    const key = thumbnailKey(file.storageKey!);
    const cached = await this.storage.provider.size(key);
    if (cached !== null) return cached === 0 ? null : readAll((await this.storage.get(key)).stream);
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.generate(file.storageKey!, file.mimeType, key).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  private async generate(sourceKey: string, mimeType: string, key: string): Promise<Buffer | null> {
    let out: Buffer | null = null;
    try {
      const source = await readAll((await this.storage.get(sourceKey)).stream);
      const input = mimeType === PDF ? await this.serially(() => renderPdfPage(source)) : source;
      const resized = await sharp(input, { limitInputPixels: 100_000_000 })
        .rotate()
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer({ resolveWithObject: true });
      const img = sharp(resized.data);
      if (resized.info.height > THUMBNAIL_MAX_HEIGHT) img.extract({ left: 0, top: 0, width: resized.info.width, height: THUMBNAIL_MAX_HEIGHT });
      out = await img.webp({ quality: 78 }).toBuffer();
    } catch (err) {
      this.log.info({ err, key: sourceKey, mimeType }, 'Could not make a thumbnail');
    }
    try {
      await this.storage.provider.put(key, Readable.from(out ? [out] : []), { contentType: 'image/webp' });
    } catch (err) {
      this.log.warn({ err, key }, 'Failed to store thumbnail');
    }
    return out;
  }

  private serially<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
