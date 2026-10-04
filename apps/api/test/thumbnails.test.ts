import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { driveFiles } from '../src/db/schema';
import { thumbnailKey } from '../src/services/thumbnails';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Thumbs');
  bob = await registerUser(ctx.app, 'Bob Thumbs');
});
afterAll(async () => {
  await ctx.close();
});

/** A one-page PDF with a heading and a filled rectangle, written by hand so the test needs no fixtures. */
function onePagePdf(): Buffer {
  const content = 'BT /F1 28 Tf 72 700 Td (Quarterly Report) Tj ET 0.2 0.4 0.9 rg 72 380 468 180 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const storageKeyOf = async (id: string) => (await ctx.app.services.db.select({ key: driveFiles.storageKey }).from(driveFiles).where(eq(driveFiles.id, id)))[0]!.key!;

describe('thumbnails', () => {
  it('makes a small WebP for an image and for a PDF’s first page', async () => {
    const a = client(ctx.app, alice);
    const photo = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#3366cc' } }).jpeg().toBuffer();
    const image = data(await a.upload('/api/drive/files/upload', 'photo.jpg', photo));
    const pdf = data(await a.upload('/api/drive/files/upload', 'report.pdf', onePagePdf()));

    for (const file of [image, pdf]) {
      expect(file.thumbnailUrl).toMatch(new RegExp(`^/drive/files/${file.id}/thumbnail\\?v=`));
      const res = await a.get(`/api${file.thumbnailUrl}`);
      expect(res.statusCode, res.body).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['cache-control']).toContain('immutable');
      const meta = await sharp(res.rawPayload).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(480);
      expect(meta.height).toBeLessThanOrEqual(640);
    }
    // The PDF page is mostly white with the blue block: proof it was really rendered, not a blank canvas.
    const { dominant } = await sharp((await a.get(`/api${pdf.thumbnailUrl}`)).rawPayload).stats();
    expect(dominant.r).toBeGreaterThan(200);
    const block = await sharp((await a.get(`/api${pdf.thumbnailUrl}`)).rawPayload).extract({ left: 100, top: 220, width: 50, height: 50 }).toBuffer();
    const blue = await sharp(block).stats();
    expect(blue.channels[2]!.mean).toBeGreaterThan(blue.channels[0]!.mean + 80);
  });

  it('isn’t offered for other types and 404s when the bytes can’t be decoded', async () => {
    const a = client(ctx.app, alice);
    const text = data(await a.upload('/api/drive/files/upload', 'notes.txt', 'hello'));
    expect(text.thumbnailUrl).toBeNull();
    expect((await a.get(`/api/drive/files/${text.id}/thumbnail`)).statusCode).toBe(404);
    // Sniffed as a PDF but broken: the failure is remembered, not retried.
    const broken = data(await a.upload('/api/drive/files/upload', 'broken.pdf', Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 1)])));
    expect(broken.mimeType).toBe('application/pdf');
    expect((await a.get(`/api/drive/files/${broken.id}/thumbnail`)).statusCode).toBe(404);
    expect(await ctx.app.services.storage.provider.size(thumbnailKey(await storageKeyOf(broken.id)))).toBe(0);
  });

  it('needs access, isn’t recorded as an open, and is removed with the file', async () => {
    const a = client(ctx.app, alice);
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#ff0000' } }).png().toBuffer();
    const file = data(await a.upload('/api/drive/files/upload', 'red.png', png));
    expect((await client(ctx.app, bob).get(`/api${file.thumbnailUrl}`)).statusCode).toBe(404);
    expect((await a.get(`/api${file.thumbnailUrl}`)).statusCode).toBe(200);
    expect((await a.get(`/api/drive/files/${file.id}/content?purpose=thumbnail`)).statusCode).toBe(200);
    const actions = data(await a.get(`/api/drive/files/${file.id}/activity`)).items.map((i: { action: string }) => i.action);
    expect(actions).not.toContain('FILE_OPENED');

    const key = thumbnailKey(await storageKeyOf(file.id));
    expect(await ctx.app.services.storage.provider.size(key)).toBeGreaterThan(0);
    await a.post(`/api/drive/files/${file.id}/trash`);
    expect(data(await a.get(`/api/drive/files/${file.id}`)).thumbnailUrl).toBeNull();
    expect((await a.delete(`/api/drive/files/${file.id}`)).statusCode).toBe(200);
    expect(await ctx.app.services.storage.provider.size(key)).toBeNull();
  });
});
