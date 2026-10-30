import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Presentation,
  Download,
  FileText,
  FilePlus,
  FileUp,
  FolderInput,
  History,
  ImagePlus,
  ListTodo,
  MessageSquarePlus,
  Minus,
  Printer,
  Redo2,
  Search,
  SeparatorHorizontal,
  Table2,
  Trash2,
  Undo2,
  Layout,
  Mic,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  RemoveFormatting,
  Columns3,
  BookOpen,
  FileCheck,
  CaseSensitive,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import mammoth from 'mammoth';
import { markdownToHtml } from '@qub/editor-schema';
import { documentFile, saveFile, type DownloadFormat } from './download';
import { TableGridPicker } from './table-grid-picker';
import {
  convertSelectionCase,
  insertCalloutBanner,
  insertExecutiveCoverPage,
  insertSignatureBlock,
  insertTableOfContents,
} from './toolbar';

export interface DocMenusProps {
  editor: Editor;
  title: string;
  canEdit: boolean;
  canComment: boolean;
  canTrash: boolean;
  /** Owner-controlled "Can download, print & copy"; when false Download and Print are not offered. */
  canDownload: boolean;
  outlineOpen: boolean;
  showRuler?: boolean;
  onToggleRuler?(): void;
  onPageSetup?(): void;
  onOrientationChange?(orientation: 'portrait' | 'landscape'): void;
  onColumnsChange?(columns: 1 | 2 | 3): void;
  onTogglePageless?(): void;
  pageless?: boolean;
  onTogglePageNumbers?(): void;
  showPageNumbers?: boolean;
  onVoiceTyping?(): void;
  onVersionHistory(): void;
  onMove(): void;
  onTrash(): void;
  onFind(replace: boolean): void;
  onToggleOutline(): void;
  onWordCount(): void;
  onPresentSlides?(): void;
  onComment(): void;
  onInsertImage(): void;
  /** Prints the document only (see `printDocument`). */
  onPrint(): void;
}

function Trigger({ label, className }: { label: string; className?: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <button className={cn('rounded-md px-2.5 py-1 text-[13.5px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer select-none', className)}>{label}</button>
    </DropdownMenuTrigger>
  );
}

/** Google Docs–style menu bar. Items needing edit rights are hidden for viewers and commenters. */
export function DocMenus(p: DocMenusProps) {
  const { editor } = p;
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo?.() ?? false,
      canRedo: e.can().redo?.() ?? false,
      empty: e.state.selection.empty,
    }),
  });
  const c = () => editor.chain().focus();
  /** Editing menus hand focus back to the document when they close, instead of to their trigger button. */
  const backToEditor = (e: Event) => {
    e.preventDefault();
    editor.view.focus();
  };

  const download = async (format: DownloadFormat) => {
    try {
      const file = await documentFile(editor, p.title, format);
      saveFile(file);
      if (file.failedImages) {
        toast.warning(
          file.failedImages === 1
            ? '1 image couldn’t be embedded; it links back to Qub instead.'
            : `${file.failedImages} images couldn’t be embedded; they link back to Qub instead.`
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <DropdownMenu>
        <Trigger label="File" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            icon={<FilePlus />}
            shortcut="Ctrl+Alt+N"
            onSelect={() => {
              const isMobileApp =
                typeof navigator !== 'undefined' &&
                (/QubDocsAndroid|Android|iPhone|iPad/i.test(navigator.userAgent) ||
                  window.innerWidth < 1024);
              if (isMobileApp) {
                window.location.href = '/docs';
              } else {
                window.open('/docs', '_blank');
              }
            }}
          >
            New document
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<FileUp />}
            shortcut="Ctrl+O"
            onSelect={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.txt,.md,.markdown,.html,.htm,.docx,.pdf';
              input.onchange = async (e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                const ext = file.name.split('.').pop()?.toLowerCase();
                try {
                  if (ext === 'md' || ext === 'markdown') {
                    const text = await file.text();
                    const html = markdownToHtml(text);
                    editor.chain().focus().setContent(html).run();
                    toast.success(`Imported ${file.name}`);
                  } else if (ext === 'txt') {
                    const text = await file.text();
                    const paragraphs = text
                      .split(/\r?\n\r?\n/)
                      .map(
                        (para) =>
                          `<p>${para
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\r?\n/g, '<br>')}</p>`
                      )
                      .join('');
                    editor.chain().focus().setContent(paragraphs || '<p></p>').run();
                    toast.success(`Imported ${file.name}`);
                  } else if (ext === 'html' || ext === 'htm') {
                    const html = await file.text();
                    editor.chain().focus().setContent(html).run();
                    toast.success(`Imported ${file.name}`);
                  } else if (ext === 'docx') {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8 = new Uint8Array(arrayBuffer);
                    const binStr = new TextDecoder('latin1').decode(uint8);
                    const isLandscape =
                      binStr.indexOf('w:orient="landscape"') !== -1 ||
                      binStr.indexOf('orient="landscape"') !== -1;
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (result.value) {
                      editor.chain().focus().setContent(result.value).run();
                      const hasWideTable =
                        (result.value.match(/<th/gi)?.length ?? 0) >= 4 ||
                        result.value.indexOf('<table') !== -1;
                      if ((isLandscape || hasWideTable) && p.onOrientationChange) {
                        p.onOrientationChange('landscape');
                        toast.success(`Loaded ${file.name} in Landscape orientation.`);
                      } else {
                        toast.success(`Successfully loaded ${file.name} for editing.`);
                      }
                    } else {
                      toast.warning('The document appeared empty.');
                    }
                  } else if (ext === 'pdf') {
                    window.open(`/drive?preview=${encodeURIComponent(file.name)}`, '_blank');
                    toast.info(`Opening ${file.name} in QubDocs PDF Editor.`);
                  } else {
                    const content = await file.text();
                    editor.chain().focus().setContent(content).run();
                    toast.success(`Imported ${file.name}`);
                  }
                } catch (err) {
                  console.error('Failed to import document:', err);
                  toast.error(`Could not read file: ${file.name}`);
                }
              };
              input.click();
            }}
          >
            Open...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<History />} onSelect={p.onVersionHistory}>
            Version history
          </DropdownMenuItem>
          {p.canEdit && (
            <>
              <DropdownMenuItem icon={<Layout />} onSelect={p.onPageSetup}>
                Page setup &amp; watermark
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<FolderInput />} onSelect={p.onMove}>
                Move
              </DropdownMenuItem>
            </>
          )}
          {p.canDownload && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger icon={<Download />}>Download</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => void download('docx')}>
                    Microsoft Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('doc')}>
                    Rich text HTML (.doc)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('pdf')}>
                    PDF document (.pdf)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void download('md')}>
                    Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('html')}>
                    Web page (.html)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('txt')}>
                    Plain text (.txt)
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                icon={<Printer />}
                shortcut="Ctrl+P"
                title="Print or save as PDF"
                onSelect={() => setTimeout(p.onPrint, 0)}
              >
                Print
              </DropdownMenuItem>
            </>
          )}
          {p.canTrash && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Trash2 />} destructive onSelect={p.onTrash}>
                Move to trash
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Trigger label="Edit" />
        <DropdownMenuContent align="start" onCloseAutoFocus={backToEditor}>
          {p.canEdit && (
            <>
              <DropdownMenuItem
                icon={<Undo2 />}
                shortcut="Ctrl+Z"
                disabled={!s.canUndo}
                onSelect={() => c().undo().run()}
              >
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Redo2 />}
                shortcut="Ctrl+Y"
                disabled={!s.canRedo}
                onSelect={() => c().redo().run()}
              >
                Redo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            icon={<Search />}
            shortcut={p.canEdit ? 'Ctrl+H' : 'Ctrl+F'}
            onSelect={() => p.onFind(p.canEdit)}
          >
            {p.canEdit ? 'Find and replace' : 'Find'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Trigger label="View" className="hidden lg:inline-block" />
        <DropdownMenuContent align="start">
          {p.onPresentSlides && (
            <>
              <DropdownMenuItem icon={<Presentation />} shortcut="F5" onSelect={p.onPresentSlides}>
                Present as slides
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {p.onTogglePageless && (
            <DropdownMenuCheckboxItem
              checked={!!p.pageless}
              onToggle={p.onTogglePageless}
              onCheckedChange={p.onTogglePageless}
            >
              Pageless mode (Wide canvas)
            </DropdownMenuCheckboxItem>
          )}
          <DropdownMenuCheckboxItem
            checked={p.outlineOpen}
            onToggle={p.onToggleOutline}
            onCheckedChange={p.onToggleOutline}
          >
            Show document outline
          </DropdownMenuCheckboxItem>
          {p.onToggleRuler && (
            <DropdownMenuCheckboxItem
              checked={!!p.showRuler}
              onToggle={p.onToggleRuler}
              onCheckedChange={p.onToggleRuler}
            >
              Show ruler
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {(p.canEdit || p.canComment) && (
        <DropdownMenu>
          <Trigger label="Insert" />
          <DropdownMenuContent align="start" onCloseAutoFocus={backToEditor}>
            {p.canEdit && (
              <>
                <DropdownMenuItem icon={<ImagePlus />} onSelect={p.onInsertImage}>
                  Image
                </DropdownMenuItem>
                <TableGridPicker editor={editor}>
                  <button
                    type="button"
                    className="relative flex h-9 w-full cursor-default select-none items-center gap-3 px-4 text-sm text-foreground outline-none hover:bg-hover [&_svg]:size-[18px] [&_svg]:text-muted"
                  >
                    <Table2 />
                    <span className="flex-1 text-left">Table</span>
                  </button>
                </TableGridPicker>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<BookOpen />}
                  onSelect={() => insertExecutiveCoverPage(editor, p.title)}
                >
                  Executive cover header
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<FileText />}
                  onSelect={() => insertTableOfContents(editor)}
                >
                  Table of contents
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger icon={<Layout />}>Callout banner</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => insertCalloutBanner(editor, 'info')}>
                      Key Note Callout (Blue)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => insertCalloutBanner(editor, 'warning')}>
                      Action Required Callout (Amber)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => insertCalloutBanner(editor, 'success')}>
                      Approved Decision Callout (Emerald)
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem icon={<FileCheck />} onSelect={() => insertSignatureBlock(editor)}>
                  Signature block
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<ListTodo />}
                  shortcut="Ctrl+Shift+9"
                  onSelect={() => c().toggleTaskList().run()}
                >
                  Checklist
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Minus />} onSelect={() => c().setHorizontalRule().run()}>
                  Horizontal line
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<SeparatorHorizontal />}
                  shortcut="Ctrl+Enter"
                  onSelect={() => c().setPageBreak().run()}
                >
                  Page break
                </DropdownMenuItem>
                {p.onPageSetup && (
                  <DropdownMenuItem icon={<Layout />} onSelect={p.onPageSetup}>
                    Headers, footers &amp; watermark
                  </DropdownMenuItem>
                )}
              </>
            )}
            {p.canComment && (
              <>
                {p.canEdit && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  icon={<MessageSquarePlus />}
                  shortcut="Ctrl+Alt+M"
                  disabled={s.empty}
                  onSelect={p.onComment}
                >
                  Comment
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {p.canEdit && (
        <DropdownMenu>
          <Trigger label="Format" />
          <DropdownMenuContent align="start" onCloseAutoFocus={backToEditor}>
            <DropdownMenuItem icon={<Bold />} shortcut="Ctrl+B" onSelect={() => c().toggleBold().run()}>
              Bold
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Italic />}
              shortcut="Ctrl+I"
              onSelect={() => c().toggleItalic().run()}
            >
              Italic
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Underline />}
              shortcut="Ctrl+U"
              onSelect={() => c().toggleUnderline().run()}
            >
              Underline
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Strikethrough />} onSelect={() => c().toggleStrike().run()}>
              Strikethrough
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger icon={<CaseSensitive />}>Change case</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => convertSelectionCase(editor, 'upper')}>
                  UPPERCASE
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => convertSelectionCase(editor, 'lower')}>
                  lowercase
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => convertSelectionCase(editor, 'title')}>
                  Title Case
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => convertSelectionCase(editor, 'sentence')}>
                  Sentence case
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {p.onColumnsChange && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger icon={<Columns3 />}>Columns</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => p.onColumnsChange?.(1)}>
                    1 Column (Standard)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => p.onColumnsChange?.(2)}>
                    2 Columns (Editorial)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => p.onColumnsChange?.(3)}>
                    3 Columns (Newsletter)
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<RemoveFormatting />}
              onSelect={() => c().unsetAllMarks().clearNodes().run()}
            >
              Clear formatting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <Trigger label="Tools" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem icon={<FileText />} shortcut="Ctrl+Shift+C" onSelect={p.onWordCount}>
            Word count
          </DropdownMenuItem>
          {p.canEdit && p.onVoiceTyping && (
            <DropdownMenuItem icon={<Mic />} shortcut="Ctrl+Shift+S" onSelect={p.onVoiceTyping}>
              Voice typing
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
