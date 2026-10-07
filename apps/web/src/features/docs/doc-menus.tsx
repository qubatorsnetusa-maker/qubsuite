import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
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
import { documentFile, saveFile, type DownloadFormat } from './download';
import { TableGridPicker } from './table-grid-picker';

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
  onTogglePageNumbers?(): void;
  showPageNumbers?: boolean;
  onVoiceTyping?(): void;
  onVersionHistory(): void;
  onMove(): void;
  onTrash(): void;
  onFind(replace: boolean): void;
  onToggleOutline(): void;
  onWordCount(): void;
  onComment(): void;
  onInsertImage(): void;
  /** Prints the document only (see `printDocument`). */
  onPrint(): void;
}

function Trigger({ label, className }: { label: string; className?: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <button className={cn('rounded px-2 py-0.5 hover:bg-hover', className)}>{label}</button>
    </DropdownMenuTrigger>
  );
}

/** Google Docs–style menu bar. Items needing edit rights are hidden for viewers and commenters. */
export function DocMenus(p: DocMenusProps) {
  const { editor } = p;
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ canUndo: e.can().undo?.() ?? false, canRedo: e.can().redo?.() ?? false, empty: e.state.selection.empty }),
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
            : `${file.failedImages} images couldn’t be embedded; they link back to Qub instead.`,
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
              window.open('/docs', '_blank');
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
                  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
                    const text = await file.text();
                    editor.chain().focus().setContent(text).run();
                    toast.success(`Imported ${file.name}`);
                  } else if (ext === 'html' || ext === 'htm') {
                    const html = await file.text();
                    editor.chain().focus().setContent(html).run();
                    toast.success(`Imported ${file.name}`);
                  } else if (ext === 'docx') {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8 = new Uint8Array(arrayBuffer);
                    const binStr = new TextDecoder('latin1').decode(uint8);
                    const isLandscape = binStr.indexOf('w:orient="landscape"') !== -1 || binStr.indexOf('orient="landscape"') !== -1;
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (result.value) {
                      editor.chain().focus().setContent(result.value).run();
                      const hasWideTable = (result.value.match(/<th/gi)?.length ?? 0) >= 4 || result.value.indexOf('<table') !== -1;
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
                    // Open in QubDocs PDF Sign & Edit dialog
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
                Page setup
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
                  <DropdownMenuItem onSelect={() => void download('doc')}>Microsoft Word (.doc)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('pdf')}>PDF document (.pdf)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void download('md')}>Markdown (.md)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('html')}>Web page (.html)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void download('txt')}>Plain text (.txt)</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {/* Deferred so the menu has closed before the (blocking) print dialog opens. */}
              <DropdownMenuItem icon={<Printer />} shortcut="Ctrl+P" title="Print or save as PDF" onSelect={() => setTimeout(p.onPrint, 0)}>
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
              <DropdownMenuItem icon={<Undo2 />} shortcut="Ctrl+Z" disabled={!s.canUndo} onSelect={() => c().undo().run()}>
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Redo2 />} shortcut="Ctrl+Y" disabled={!s.canRedo} onSelect={() => c().redo().run()}>
                Redo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem icon={<Search />} shortcut={p.canEdit ? 'Ctrl+H' : 'Ctrl+F'} onSelect={() => p.onFind(p.canEdit)}>
            {p.canEdit ? 'Find and replace' : 'Find'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Trigger label="View" className="hidden lg:inline-block" />
        <DropdownMenuContent align="start">
          <DropdownMenuCheckboxItem checked={p.outlineOpen} onToggle={p.onToggleOutline} onCheckedChange={p.onToggleOutline}>
            Show outline
          </DropdownMenuCheckboxItem>
          {p.onToggleRuler && (
            <DropdownMenuCheckboxItem checked={!!p.showRuler} onToggle={p.onToggleRuler} onCheckedChange={p.onToggleRuler}>
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
                <DropdownMenuItem icon={<ListTodo />} shortcut="Ctrl+Shift+9" onSelect={() => c().toggleTaskList().run()}>
                  Checklist
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Minus />} onSelect={() => c().setHorizontalRule().run()}>
                  Horizontal line
                </DropdownMenuItem>
                <DropdownMenuItem icon={<SeparatorHorizontal />} shortcut="Ctrl+Enter" onSelect={() => c().setPageBreak().run()}>
                  Page break
                </DropdownMenuItem>
              </>
            )}
            {p.canComment && (
              <>
                {p.canEdit && <DropdownMenuSeparator />}
                <DropdownMenuItem icon={<MessageSquarePlus />} shortcut="Ctrl+Alt+M" disabled={s.empty} onSelect={p.onComment}>
                  Comment
                </DropdownMenuItem>
              </>
            )}
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
