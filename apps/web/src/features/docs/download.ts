import { toMarkdown, toPlainText } from '@qub/editor-schema';
import { getHTMLFromFragment, type Editor, type JSONContent } from '@tiptap/core';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type DownloadFormat = 'md' | 'html' | 'txt' | 'doc' | 'pdf';
export interface DownloadFile {
  filename: string;
  mime: string;
  content: string | Uint8Array;
}

export function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 150)
    .trim();
  return cleaned || 'Untitled document';
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Mirrors the editor typography in `index.css` so the downloaded page looks like the document. */
const EXPORT_CSS = `
body{margin:0;background:#fff;color:#202124;font:11pt/1.5 Arial,Helvetica,sans-serif}
main{max-width:816px;margin:0 auto;padding:96px;box-sizing:border-box}
main>*+*{margin-top:.4em}
h1{font-size:20pt;font-weight:400}h2{font-size:16pt;font-weight:400}h3{font-size:14pt;font-weight:500;color:#434343}h4{font-size:12pt;font-weight:600;color:#666}
blockquote{border-left:3px solid #dadce0;margin-left:0;padding-left:1em;color:#5f6368}
pre{background:#f1f3f4;border-radius:8px;padding:.75em 1em;font-size:10pt;white-space:pre-wrap}code{font-family:"Courier New",Courier,monospace}
a{color:#1a0dab}img{max-width:100%;height:auto}hr{border:none;border-top:1px solid #dadce0;margin:1em 0}
table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #c4c7c5;padding:4px 8px;vertical-align:top}th{background:#f1f3f4;text-align:left}
ul[data-type=taskList]{list-style:none;padding-left:.2em}ul[data-type=taskList]>li{display:flex;gap:.5em;align-items:baseline}ul[data-type=taskList]>li>div{flex:1}ul[data-type=taskList]>li>div>p{margin:0}ul[data-type=taskList]>li[data-checked=true]>div>p{color:#80868b;text-decoration:line-through}
li>p{margin:0}.mention{color:#1a56db}
.qub-manual-break{break-after:page;border-top:1px dashed #c4c7c5;margin:1em 0}
@media print{@page{margin:1in}main{max-width:none;padding:0}.qub-manual-break{border:none;margin:0}h1,h2,h3,h4{break-after:avoid}img,tr,pre,blockquote{break-inside:avoid}}
`;

export function buildStandaloneHtml(title: string, bodyHtml: string, origin: string): string {
  const body = bodyHtml.replace(/(<img\b[^>]*\bsrc=")(\/(?!\/)[^"]*)"/g, (_m, pre: string, path: string) => `${pre}${origin}${path}"`);
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n<main>${body}</main>\n</body>\n</html>\n`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/**
 * Qub-hosted images need the session cookie, so a downloaded file opened elsewhere could not load them. They are
 * fetched now (with credentials) and inlined as data URIs. External images are left as they are. Images that cannot
 * be fetched keep an absolute link back to Qub and are counted in `failed` so the user can be told.
 */
export async function embedImages(doc: JSONContent, origin: string, fetchImpl: typeof fetch = fetch): Promise<{ doc: JSONContent; failed: number }> {
  let failed = 0;
  const visit = async (node: JSONContent): Promise<JSONContent> => {
    const content = node.content ? await Promise.all(node.content.map(visit)) : undefined;
    const out: JSONContent = { ...node, ...(content ? { content } : {}) };
    const src = node.type === 'image' ? node.attrs?.src : undefined;
    if (typeof src !== 'string' || src.startsWith('data:')) return out;
    const url = new URL(src, origin);
    if (url.origin !== new URL(origin).origin) return out;
    try {
      const res = await fetchImpl(url.href, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ...out, attrs: { ...node.attrs, src: await blobToDataUrl(await res.blob()) } };
    } catch {
      failed++;
      return { ...out, attrs: { ...node.attrs, src: url.href } };
    }
  };
  return { doc: await visit(doc), failed };
}

export interface DocumentDownload extends DownloadFile {
  /** Images that could not be embedded (they link back to Qub instead). */
  failedImages: number;
}

export async function documentFile(
  editor: Editor,
  title: string,
  format: DownloadFormat,
  origin = window.location.origin,
  fetchImpl: typeof fetch = fetch,
): Promise<DocumentDownload> {
  const base = sanitizeFilename(title);
  if (format === 'txt') {
    return { filename: `${base}.txt`, mime: 'text/plain;charset=utf-8', content: toPlainText(editor.getJSON()), failedImages: 0 };
  }
  const { doc, failed } = await embedImages(editor.getJSON(), origin, fetchImpl);
  if (format === 'md') {
    return { filename: `${base}.md`, mime: 'text/markdown;charset=utf-8', content: toMarkdown(doc), failedImages: failed };
  }

  const body = getHTMLFromFragment(editor.schema.nodeFromJSON(doc).content, editor.schema);
  const standaloneHtml = buildStandaloneHtml(title, body, origin);

  if (format === 'html') {
    return { filename: `${base}.html`, mime: 'text/html;charset=utf-8', content: standaloneHtml, failedImages: failed };
  }

  if (format === 'doc') {
    // Standard MSO Word HTML document with full Word styling and page definitions
    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page WordSection1 {
  size: 8.5in 11.0in;
  margin: 1.0in 1.0in 1.0in 1.0in;
  mso-header-margin: 0.5in;
  mso-footer-margin: 0.5in;
  mso-paper-source: 0;
}
div.WordSection1 {
  page: WordSection1;
}
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #202124;
}
p {
  margin: 0 0 10pt 0;
  mso-line-height-rule: exactly;
}
h1 {
  font-size: 20pt;
  font-weight: bold;
  color: #1a73e8;
  margin: 18pt 0 6pt 0;
  page-break-after: avoid;
}
h2 {
  font-size: 15pt;
  font-weight: bold;
  color: #202124;
  margin: 14pt 0 4pt 0;
  page-break-after: avoid;
}
h3 {
  font-size: 13pt;
  font-weight: bold;
  color: #434343;
  margin: 10pt 0 2pt 0;
  page-break-after: avoid;
}
table {
  border-collapse: collapse;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
  margin: 12pt 0;
  width: 100%;
}
td, th {
  border: 1pt solid #c4c7c5;
  padding: 6pt 8pt;
  vertical-align: top;
}
th {
  background: #f1f3f4;
  font-weight: bold;
}
blockquote {
  border-left: 3pt solid #dadce0;
  margin: 10pt 0;
  padding-left: 12pt;
  color: #5f6368;
}
ul, ol {
  margin: 0 0 10pt 24pt;
}
li {
  margin: 0 0 4pt 0;
}
code {
  font-family: Consolas, "Courier New", Courier, monospace;
  background-color: #f1f3f4;
  padding: 1pt 3pt;
  border-radius: 3pt;
}
pre {
  background-color: #f1f3f4;
  padding: 8pt;
  font-family: Consolas, "Courier New", Courier, monospace;
}
</style>
</head>
<body>
<div class="WordSection1">
<main>${body}</main>
</div>
</body>
</html>`;
    return { filename: `${base}.doc`, mime: 'application/msword;charset=utf-8', content: wordHtml, failedImages: failed };
  }

  if (format === 'pdf') {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const plain = toPlainText(editor.getJSON());
    const lines = plain.split('\n');

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 54;
    const fontSize = 11;
    const lineHeight = 16;
    let y = height - margin;

    // Draw document title
    page.drawText(title || 'Untitled Document', {
      x: margin,
      y,
      size: 18,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.2),
    });
    y -= 30;

    for (const rawLine of lines) {
      // Basic word wrap
      const words = rawLine.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = helvetica.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > width - margin * 2 && currentLine) {
          if (y < margin + lineHeight) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
          }
          page.drawText(currentLine, {
            x: margin,
            y,
            size: fontSize,
            font: helvetica,
            color: rgb(0.15, 0.15, 0.15),
          });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine || rawLine === '') {
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - margin;
        }
        if (currentLine) {
          page.drawText(currentLine, {
            x: margin,
            y,
            size: fontSize,
            font: helvetica,
            color: rgb(0.15, 0.15, 0.15),
          });
        }
        y -= lineHeight;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return {
      filename: `${base}.pdf`,
      mime: 'application/pdf',
      content: pdfBytes,
      failedImages: failed,
    };
  }

  return { filename: `${base}.html`, mime: 'text/html;charset=utf-8', content: standaloneHtml, failedImages: failed };
}

export function saveFile(file: DownloadFile) {
  const blobParts: BlobPart[] = typeof file.content === 'string' ? [file.content] : [file.content as Uint8Array<ArrayBuffer>];
  const url = URL.createObjectURL(new Blob(blobParts, { type: file.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
