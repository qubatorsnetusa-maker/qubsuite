import type { CellStyle, FormFieldType, LibraryPreview } from '@qub/shared';
import { formattedValueOf } from '@qub/shared/formula';
import { buildSheetTemplate, type DocNode, type Template } from '@qub/shared/templates';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lays out `children` at a fixed design width and scales it to the container's width, so thumbnails are real
 * renderings of the content rather than drawings. Decorative: hidden from assistive technology.
 */
function ScaledCanvas({ width, children, className }: { width: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setScale(el.clientWidth / width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setScale(entry.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)} aria-hidden>
      <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ---------- documents ----------

type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[]; marks?: { type: string; attrs?: Record<string, unknown> }[]; text?: string };

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

function withMarks(text: string, marks: Json['marks'], key: number): ReactNode {
  let node: ReactNode = text;
  for (const m of marks ?? []) {
    switch (m.type) {
      case 'bold':
        node = <strong>{node}</strong>;
        break;
      case 'italic':
        node = <em>{node}</em>;
        break;
      case 'underline':
        node = <u>{node}</u>;
        break;
      case 'strike':
        node = <s>{node}</s>;
        break;
      case 'code':
        node = <code>{node}</code>;
        break;
      // Links render as styled text: thumbnails are never interactive.
      case 'link':
        node = <span className="text-[#1a0dab] underline">{node}</span>;
        break;
      case 'textStyle':
        node = <span style={{ color: str(m.attrs?.color), fontSize: str(m.attrs?.fontSize), backgroundColor: str(m.attrs?.backgroundColor) }}>{node}</span>;
        break;
      case 'highlight':
        node = <mark style={{ backgroundColor: str(m.attrs?.color) ?? '#fef08a' }}>{node}</mark>;
        break;
    }
  }
  return <span key={key}>{node}</span>;
}

function renderDocNodes(nodes: Json[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => renderDocNode(n, i));
}

function renderDocNode(n: Json, key: number): ReactNode {
  const children = renderDocNodes(n.content);
  const align = str(n.attrs?.textAlign) as CSSProperties['textAlign'];
  switch (n.type) {
    case 'text':
      return withMarks(n.text ?? '', n.marks, key);
    case 'paragraph':
      return <p key={key} style={{ textAlign: align }}>{children.length ? children : <br />}</p>;
    case 'heading': {
      const level = Math.min(4, Math.max(1, Number(n.attrs?.level) || 1));
      const H = `h${level}` as 'h1';
      return <H key={key} style={{ textAlign: align }}>{children}</H>;
    }
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return <ol key={key} start={Number(n.attrs?.start) || 1}>{children}</ol>;
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return <pre key={key}><code>{children}</code></pre>;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'hardBreak':
      return <br key={key} />;
    case 'table':
      return <table key={key}><tbody>{children}</tbody></table>;
    case 'tableRow':
      return <tr key={key}>{children}</tr>;
    case 'tableHeader':
      return <th key={key} colSpan={Number(n.attrs?.colspan) || 1}>{children}</th>;
    case 'tableCell':
      return <td key={key} colSpan={Number(n.attrs?.colspan) || 1}>{children}</td>;
    case 'image': {
      const src = str(n.attrs?.src);
      // Only same-origin document assets; anything else is skipped.
      return src?.startsWith('/api/') ? <img key={key} src={src} alt="" loading="lazy" /> : null;
    }
    case 'mention':
      return <span key={key} className="mention">@{str(n.attrs?.label) ?? ''}</span>;
    default:
      return <span key={key}>{children}</span>;
  }
}

/** A Letter page (816px wide at 96dpi, 1in margins) showing the document's first blocks. */
export function DocThumbnail({ blocks, className }: { blocks: unknown[]; className?: string }) {
  return (
    <ScaledCanvas width={816} className={cn('bg-white', className)}>
      <div className="qub-doc-preview px-[96px] py-[80px]">{renderDocNodes(blocks as Json[])}</div>
    </ScaledCanvas>
  );
}

// ---------- spreadsheets ----------

type PreviewCell = { row: number; col: number; formattedValue: string; style: CellStyle | null };
const ROWS = 14;
const COLS = 6;
const NUMERIC = /^[-+($]?[\d,.]+%?\)?$/;

/** The top-left of the first sheet, drawn as a grid with the cells' own formatting. */
export function SheetThumbnail({ cells, className }: { cells: PreviewCell[]; className?: string }) {
  const byKey = new Map(cells.map((c) => [`${c.row}:${c.col}`, c]));
  return (
    <ScaledCanvas width={640} className={cn('bg-white', className)}>
      <table className="w-[640px] table-fixed border-collapse text-[13px] text-[#202124]">
        <tbody>
          {Array.from({ length: ROWS }, (_, r) => (
            <tr key={r} className="h-[26px]">
              {Array.from({ length: COLS }, (_, c) => {
                const cell = byKey.get(`${r}:${c}`);
                const s = cell?.style;
                // Like the grid: text spills into the next cell when that cell is empty.
                const spills = !byKey.get(`${r}:${c + 1}`)?.formattedValue;
                return (
                  <td
                    key={c}
                    className={cn('whitespace-nowrap border border-[#e2e3e3] px-1.5', spills ? 'overflow-visible' : 'overflow-hidden')}
                    style={{
                      fontWeight: s?.bold ? 700 : undefined,
                      fontStyle: s?.italic ? 'italic' : undefined,
                      color: s?.color,
                      background: s?.background,
                      fontSize: s?.fontSize ? `${s.fontSize}px` : undefined,
                      textAlign: s?.align ?? (cell && NUMERIC.test(cell.formattedValue) ? 'right' : 'left'),
                    }}
                  >
                    {cell?.formattedValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScaledCanvas>
  );
}

// ---------- forms ----------

type FormPreview = Extract<LibraryPreview, { kind: 'form' }>;

function FieldStub({ type, color }: { type: FormFieldType; color: string }) {
  if (type === 'MULTIPLE_CHOICE' || type === 'CHECKBOXES') {
    return (
      <div className="mt-3 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={cn('size-4 border-2 border-[#5f6368]', type === 'MULTIPLE_CHOICE' ? 'rounded-full' : 'rounded-sm')} />
            <span className="h-2 w-28 rounded bg-[#e0e0e0]" />
          </div>
        ))}
      </div>
    );
  }
  if (type === 'RATING') return <div className="mt-3 text-lg tracking-widest" style={{ color }}>★★★★★</div>;
  if (type === 'LINEAR_SCALE') {
    return (
      <div className="mt-3 flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => <span key={i} className="size-4 rounded-full border-2 border-[#5f6368]" />)}
      </div>
    );
  }
  if (type === 'SECTION') return null;
  return <div className="mt-4 h-px w-1/2 bg-[#bdbdbd]" />;
}

/** The form's header card and its first questions, in its theme colours. */
export function FormThumbnail({ title, preview, className }: { title: string; preview: Omit<FormPreview, 'kind'>; className?: string }) {
  return (
    <ScaledCanvas width={640} className={className}>
      <div className="min-h-[900px] px-12 pt-8 text-[#202124]" style={{ background: preview.backgroundColor }}>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="h-2.5" style={{ background: preview.primaryColor }} />
          <div className="px-6 py-5">
            <div className="text-[28px] leading-tight">{title}</div>
            {preview.description && <div className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-[#5f6368]">{preview.description}</div>}
          </div>
        </div>
        {preview.fields.map((f, i) => (
          <div key={i} className="mt-3 rounded-lg bg-white px-6 py-5 shadow-sm">
            <div className={cn('text-[15px]', f.type === 'SECTION' && 'text-lg font-medium')} style={f.type === 'SECTION' ? { color: preview.primaryColor } : undefined}>
              {f.label}
            </div>
            <FieldStub type={f.type} color={preview.primaryColor} />
          </div>
        ))}
      </div>
    </ScaledCanvas>
  );
}

// ---------- adapters ----------

/** Thumbnail for a stored file's preview (from the library endpoint). */
export function PreviewThumbnail({ title, preview, className }: { title: string; preview: LibraryPreview | null; className?: string }) {
  if (!preview) return <div className={cn('bg-white', className)} />;
  if (preview.kind === 'document') return <DocThumbnail blocks={preview.blocks} className={className} />;
  if (preview.kind === 'spreadsheet') return <SheetThumbnail cells={preview.cells} className={className} />;
  return <FormThumbnail title={title} preview={preview} className={className} />;
}

/** Thumbnail for a gallery template, rendered from the same definition the server creates files from. */
export function TemplateThumbnail({ template, className }: { template: Template; className?: string }) {
  const sheetCells = useMemo(() => {
    if (template.app !== 'SPREADSHEET') return [];
    const [first] = buildSheetTemplate(template, template.sheets.map((_, i) => `preview-${i}`));
    return (first?.cells ?? [])
      .filter((c) => c.row < ROWS && c.col < COLS)
      .map((c) => ({ row: c.row, col: c.col, formattedValue: formattedValueOf(c.cell), style: c.cell.style }));
  }, [template]);
  if (template.app === 'DOCUMENT') return <DocThumbnail blocks={(template.content.content ?? []) as DocNode[]} className={className} />;
  if (template.app === 'SPREADSHEET') return <SheetThumbnail cells={sheetCells} className={className} />;
  return (
    <FormThumbnail
      title={template.name}
      preview={{ description: template.description, primaryColor: template.theme.primaryColor, backgroundColor: template.theme.backgroundColor, fields: template.fields.filter((f) => f.type !== 'WELCOME' && f.type !== 'ENDING').slice(0, 4) }}
      className={className}
    />
  );
}
