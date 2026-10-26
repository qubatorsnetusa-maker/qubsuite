import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { Services } from '../../services/container';

export interface RouteMeta {
  title: string;
  description: string;
  siteName: string;
}

export async function resolveRouteMetadata(services: Services, urlPath: string): Promise<RouteMeta> {
  const cleanPath = urlPath.split('?')[0] || '';
  const formMatch = cleanPath.match(/^\/forms\/([A-Za-z0-9_-]{16,64})/);
  const shareMatch = cleanPath.match(/^\/share\/([A-Za-z0-9_-]{16,64})/);
  const docMatch = cleanPath.match(/^\/docs\/([0-9a-fA-F-]{36})/);
  const sheetMatch = cleanPath.match(/^\/sheets\/([0-9a-fA-F-]{36})/);

  let title = 'QubSuite – Documents, Spreadsheets, Slides & Forms';
  let description = 'Collaborate on documents, spreadsheets, presentations, and forms in real time with QubSuite.';
  let siteName = 'QubSuite';

  try {
    if (formMatch) {
      const publicId = formMatch[1]!;
      const [formRecord] = await services.db
        .select({ title: schema.driveFiles.name, description: schema.forms.description })
        .from(schema.forms)
        .innerJoin(schema.driveFiles, eq(schema.forms.fileId, schema.driveFiles.id))
        .where(eq(schema.forms.publicId, publicId));
      if (formRecord) {
        title = `${formRecord.title} – Qub Forms`;
        description = formRecord.description || 'Fill out this form on Qub Forms';
        siteName = 'Qub Forms';
      }
    } else if (shareMatch) {
      const token = shareMatch[1]!;
      const [shareRecord] = await services.db
        .select({
          fileName: schema.driveFiles.name,
          folderName: schema.driveFolders.name,
          resourceType: schema.shareLinks.resourceType,
        })
        .from(schema.shareLinks)
        .leftJoin(schema.driveFiles, eq(schema.shareLinks.fileId, schema.driveFiles.id))
        .leftJoin(schema.driveFolders, eq(schema.shareLinks.folderId, schema.driveFolders.id))
        .where(eq(schema.shareLinks.token, token));
      if (shareRecord) {
        const name = shareRecord.fileName || shareRecord.folderName || 'Shared Item';
        title = `${name} – Qub Drive`;
        description = shareRecord.resourceType === 'FOLDER' ? 'Folder shared securely on Qub Drive' : 'File shared securely on Qub Drive';
        siteName = 'Qub Drive';
      }
    } else if (docMatch) {
      const docId = docMatch[1]!;
      const [docRecord] = await services.db
        .select({ title: schema.driveFiles.name })
        .from(schema.documents)
        .innerJoin(schema.driveFiles, eq(schema.documents.fileId, schema.driveFiles.id))
        .where(eq(schema.documents.id, docId));
      if (docRecord) {
        title = `${docRecord.title} – Qub Docs`;
        description = 'Collaborate on this document in real time with Qub Docs';
        siteName = 'Qub Docs';
      }
    } else if (sheetMatch) {
      const sheetId = sheetMatch[1]!;
      const [sheetRecord] = await services.db
        .select({ title: schema.driveFiles.name })
        .from(schema.spreadsheets)
        .innerJoin(schema.driveFiles, eq(schema.spreadsheets.fileId, schema.driveFiles.id))
        .where(eq(schema.spreadsheets.id, sheetId));
      if (sheetRecord) {
        title = `${sheetRecord.title} – Qub Sheets`;
        description = 'Collaborate on this spreadsheet in real time with Qub Sheets';
        siteName = 'Qub Sheets';
      }
    }
  } catch {
    // fallback to generic defaults
  }

  return { title, description, siteName };
}

export function injectHtmlMetadata(html: string, meta: RouteMeta, url?: string): string {
  const escape = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const safeTitle = escape(meta.title);
  const safeDesc = escape(meta.description);
  const safeSite = escape(meta.siteName);

  let out = html
    .replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${safeTitle}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${safeDesc}" />`)
    .replace(/<meta property="og:site_name" content=".*?" \/>/i, `<meta property="og:site_name" content="${safeSite}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
    .replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${safeDesc}" />`);

  if (url) {
    out = out.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escape(url)}" />`);
  }

  return out;
}
