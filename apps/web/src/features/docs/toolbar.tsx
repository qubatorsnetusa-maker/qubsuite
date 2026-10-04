import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquarePlus,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  Mic,
  Indent,
  Outdent,
  Baseline,
  ArrowUpDown,
  Check,
  ListTodo,
  Plus,
  Printer,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
} from 'lucide-react';
import { LINE_HEIGHTS, type LineHeight } from '@qub/editor-schema';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { currentFontSize, FONT_FAMILIES, parseFontSizeInput, stepFontSize } from './font';
import { useImageUpload } from './image-upload';
import { TableGridPicker } from './table-grid-picker';

const COLORS = ['#000000', '#434343', '#666666', '#999999', '#d93025', '#e37400', '#f9ab00', '#188038', '#1a73e8', '#9334e6', '#c5221f', '#b06000'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

function ToolButton({ label, active, disabled, onClick, children, shortcut }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode; shortcut?: string }) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn('flex size-8 shrink-0 items-center justify-center rounded text-[#444746] hover:bg-black/5 disabled:opacity-40 [&_svg]:size-[18px]', active && 'bg-primary-soft text-[#041e49]')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;

function ColorPicker({ label, icon, colors, current, onPick, onClear }: { label: string; icon: ReactNode; colors: string[]; current?: string; onPick(c: string): void; onClear(): void }) {
  return (
    <Popover>
      <Tooltip content={label}>
        <PopoverTrigger asChild>
          <button type="button" onMouseDown={(e) => e.preventDefault()} aria-label={label} className="flex size-8 shrink-0 flex-col items-center justify-center rounded text-[#444746] hover:bg-black/5 [&_svg]:size-[17px]">
            {icon}
            <span className="-mt-0.5 h-1 w-4 rounded-sm" style={{ background: current ?? 'transparent' }} />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-auto p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map((c) => (
            <button key={c} type="button" onClick={() => onPick(c)} className="size-6 rounded-full border border-black/10" style={{ background: c }} aria-label={`${label} ${c}`} />
          ))}
        </div>
        <button type="button" onClick={onClear} className="mt-2 text-xs text-primary hover:underline">
          Reset
        </button>
      </PopoverContent>
    </Popover>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl((editor.getAttributes('link').href as string) ?? '');
      }}
    >
      <Tooltip content="Insert link (Ctrl+K)">
        <PopoverTrigger asChild>
          <button type="button" onMouseDown={(e) => e.preventDefault()} aria-label="Insert link" className={cn('flex size-8 items-center justify-center rounded hover:bg-black/5 [&_svg]:size-[18px]', editor.isActive('link') && 'bg-primary-soft')}>
            <Link2 />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const href = url.trim();
            if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
            else if (!/^(https?:|mailto:)/i.test(href)) toast.error('Links must start with http://, https:// or mailto:');
            else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            setOpen(false);
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" autoFocus aria-label="Link URL" className="h-9" />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function FontSizeControl({ editor, size }: { editor: Editor; size: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const apply = (n: number) => editor.chain().focus().setFontSize(`${n}pt`).run();
  return (
    <div className="flex shrink-0 items-center">
      <ToolButton label="Decrease font size" shortcut="Ctrl+Shift+," onClick={() => apply(stepFontSize(size, -1))}>
        <Minus />
      </ToolButton>
      <input
        aria-label="Font size"
        inputMode="numeric"
        value={draft ?? String(size)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const n = parseFontSizeInput(draft ?? '');
            if (n !== null) apply(n);
            setDraft(null);
          } else if (e.key === 'Escape') {
            setDraft(null);
            editor.commands.focus();
          }
        }}
        className="h-7 w-10 rounded border border-border bg-transparent text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <ToolButton label="Increase font size" shortcut="Ctrl+Shift+." onClick={() => apply(stepFontSize(size, 1))}>
        <Plus />
      </ToolButton>
    </div>
  );
}

const SPACING_LABELS: Record<LineHeight, string> = { '1': 'Single', '1.15': '1.15', '1.5': '1.5', '2': 'Double' };

function LineSpacingMenu({ editor, current }: { editor: Editor; current: string | null }) {
  const value = current ?? '1.5';
  return (
    <DropdownMenu>
      <Tooltip content="Line spacing">
        <DropdownMenuTrigger asChild>
          <button type="button" onMouseDown={(e) => e.preventDefault()} aria-label="Line spacing" className="flex size-8 shrink-0 items-center justify-center rounded text-[#444746] hover:bg-black/5 [&_svg]:size-[18px]">
            <ArrowUpDown />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      {/* Return focus to the document (not the trigger) so typing continues where it was. */}
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.commands.focus();
        }}
      >
        {LINE_HEIGHTS.map((v) => (
          <DropdownMenuItem key={v} icon={value === v ? <Check /> : <span className="size-4" />} onSelect={() => editor.chain().focus().setBlockLineHeight(v).run()}>
            {SPACING_LABELS[v]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocToolbar({
  editor,
  documentId,
  canEdit,
  canComment,
  onComment,
  onPrint,
  onVoiceTyping,
  voiceActive,
}: {
  editor: Editor;
  documentId: string;
  canEdit: boolean;
  canComment: boolean;
  onComment(): void;
  onVoiceTyping?(): void;
  voiceActive?: boolean;
  /** Present when the user may print (the owner hasn't turned downloading off). */
  onPrint?: () => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('codeBlock'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      heading: ([1, 2, 3, 4] as const).find((l) => e.isActive('heading', { level: l })) ?? 0,
      align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      color: e.getAttributes('textStyle').color as string | undefined,
      highlight: e.getAttributes('highlight').color as string | undefined,
      empty: e.state.selection.empty,
      canUndo: e.can().undo?.() ?? false,
      canRedo: e.can().redo?.() ?? false,
      table: e.isActive('table'),
      task: e.isActive('taskList'),
      sub: e.isActive('subscript'),
      sup: e.isActive('superscript'),
      fontFamily: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      fontSize: currentFontSize(e),
      lineHeight: (e.getAttributes('paragraph').lineHeight ?? e.getAttributes('heading').lineHeight ?? null) as string | null,
    }),
  });
  const image = useImageUpload(editor, documentId);
  const c = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="mx-2 flex h-10 items-center gap-0.5 overflow-x-auto rounded-full bg-[#edf2fa] px-3 sm:mx-4">
      <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={!canEdit || !s.canUndo} onClick={() => c().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Redo" shortcut="Ctrl+Y" disabled={!canEdit || !s.canRedo} onClick={() => c().redo().run()}>
        <Redo2 />
      </ToolButton>
      {onPrint && (
        <ToolButton label="Print" shortcut="Ctrl+P" onClick={onPrint}>
          <Printer />
        </ToolButton>
      )}
      {onVoiceTyping && (
        <ToolButton
          label="Voice typing (Audio input)"
          shortcut="Ctrl+Shift+S"
          active={voiceActive}
          onClick={onVoiceTyping}
        >
          <Mic className={voiceActive ? "text-rose-500 animate-pulse" : ""} />
        </ToolButton>
      )}
      <Divider />
      <select
        aria-label="Text style"
        disabled={!canEdit}
        value={s.heading}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level) c().setHeading({ level: level as 1 | 2 | 3 | 4 }).run();
          else c().setParagraph().run();
        }}
        className="h-8 w-32 shrink-0 rounded bg-transparent px-1 text-sm hover:bg-black/5 focus:outline-none"
      >
        <option value={0}>Normal text</option>
        <option value={1}>Title</option>
        <option value={2}>Heading 1</option>
        <option value={3}>Heading 2</option>
        <option value={4}>Heading 3</option>
      </select>
      <Divider />
      {canEdit && (
        <>
          <select
            aria-label="Font"
            value={s.fontFamily}
            onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}
            className="h-8 w-32 shrink-0 rounded bg-transparent px-1 text-sm hover:bg-black/5 focus:outline-none"
          >
            <option value="">Default</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
            {s.fontFamily && !FONT_FAMILIES.some((f) => f.value === s.fontFamily) && (
              <option value={s.fontFamily}>{s.fontFamily.split(',')[0]!.replace(/["']/g, '').trim()}</option>
            )}
          </select>
          <Divider />
          <FontSizeControl editor={editor} size={s.fontSize} />
          <Divider />
          <ToolButton label="Bold" shortcut="Ctrl+B" active={s.bold} onClick={() => c().toggleBold().run()}>
            <Bold />
          </ToolButton>
          <ToolButton label="Italic" shortcut="Ctrl+I" active={s.italic} onClick={() => c().toggleItalic().run()}>
            <Italic />
          </ToolButton>
          <ToolButton label="Underline" shortcut="Ctrl+U" active={s.underline} onClick={() => c().toggleUnderline().run()}>
            <Underline />
          </ToolButton>
          <ToolButton label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
            <Strikethrough />
          </ToolButton>
          <ToolButton label="Subscript" shortcut="Ctrl+," active={s.sub} onClick={() => c().toggleSubscript().run()}>
            <SubscriptIcon />
          </ToolButton>
          <ToolButton label="Superscript" shortcut="Ctrl+." active={s.sup} onClick={() => c().toggleSuperscript().run()}>
            <SuperscriptIcon />
          </ToolButton>
          <ColorPicker label="Text color" icon={<Baseline />} colors={COLORS} current={s.color} onPick={(col) => c().setColor(col).run()} onClear={() => c().unsetColor().run()} />
          <ColorPicker label="Highlight color" icon={<Highlighter />} colors={HIGHLIGHTS} current={s.highlight} onPick={(col) => c().setHighlight({ color: col }).run()} onClear={() => c().unsetHighlight().run()} />
          <Divider />
          <LinkButton editor={editor} />
          <ToolButton label="Insert image" onClick={image.pick}>
            <ImagePlus />
          </ToolButton>
          {image.input}
          {s.table ? (
            <ToolButton label="Delete table" active onClick={() => c().deleteTable().run()}>
              <Table2 />
            </ToolButton>
          ) : (
            <TableGridPicker editor={editor}>
              <button
                type="button"
                className={cn(
                  'flex size-7 items-center justify-center rounded text-foreground transition-colors hover:bg-hover [&_svg]:size-4',
                )}
                title="Insert table"
                aria-label="Insert table"
              >
                <Table2 />
              </button>
            </TableGridPicker>
          )}
          <Divider />
          {(['left', 'center', 'right', 'justify'] as const).map((a) => (
            <ToolButton key={a} label={`Align ${a}`} active={s.align === a} onClick={() => c().setTextAlign(a).run()}>
              {{ left: <AlignLeft />, center: <AlignCenter />, right: <AlignRight />, justify: <AlignJustify /> }[a]}
            </ToolButton>
          ))}
          <LineSpacingMenu editor={editor} current={s.lineHeight} />
          <Divider />
          <ToolButton label="Bulleted list" shortcut="Ctrl+Shift+8" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
            <List />
          </ToolButton>
          <ToolButton label="Numbered list" shortcut="Ctrl+Shift+7" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
            <ListOrdered />
          </ToolButton>
          <ToolButton label="Checklist" shortcut="Ctrl+Shift+9" active={s.task} onClick={() => c().toggleTaskList().run()}>
            <ListTodo />
          </ToolButton>
          <ToolButton label="Decrease indent" shortcut="Shift+Tab" onClick={() => {
            if (c().liftListItem('listItem').run()) return;
            c().liftListItem('taskItem').run();
          }}>
            <Outdent />
          </ToolButton>
          <ToolButton label="Increase indent" shortcut="Tab" onClick={() => {
            if (c().sinkListItem('listItem').run()) return;
            c().sinkListItem('taskItem').run();
          }}>
            <Indent />
          </ToolButton>
          <ToolButton label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
            <Quote />
          </ToolButton>
          <ToolButton label="Code block" active={s.code} onClick={() => c().toggleCodeBlock().run()}>
            <Code2 />
          </ToolButton>
          <ToolButton label="Horizontal line" onClick={() => c().setHorizontalRule().run()}>
            <Minus />
          </ToolButton>
          <ToolButton label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}>
            <RemoveFormatting />
          </ToolButton>
          <Divider />
        </>
      )}
      {canComment && (
        <ToolButton label="Add comment" shortcut="Ctrl+Alt+M" disabled={s.empty} onClick={onComment}>
          <MessageSquarePlus />
        </ToolButton>
      )}
      {!canEdit && <span className="ml-2 whitespace-nowrap text-xs text-muted">{canComment ? 'Commenting' : 'Viewing'} only</span>}
    </div>
  );
}
