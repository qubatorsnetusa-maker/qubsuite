import ImageResize from 'tiptap-extension-resize-image';
import { HorizontalRuler } from './doc-ruler';
import { VerticalRuler } from './vertical-ruler';
import { FloatingAiBar, type AiMode } from './floating-ai-bar';
import { extractPlainText, textStats } from '@qub/editor-schema';
import type { CollaboratorDto } from '@qub/shared';
import { roleAtLeast } from '@qub/shared';
import { documentExtensions } from '@qub/editor-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { History, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EditorHeader, SaveIndicator } from '@/components/editor-header';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { presenceColor } from '@qub/shared';
import { cn, randomId } from '@/lib/utils';
import { docsService } from '@/services/docs';
import { qk } from '@/services/query-keys';
import { MoveDialog } from '../drive/dialogs';
import { ShareDialog } from '../sharing/share-dialog';
import { CommentHighlights, createAnchor, setAnchorView } from './comment-anchors';
import { CommentsPanel, type Draft } from './comments-panel';
import { DocMenus, type DocMenusProps } from './doc-menus';
import { FindReplace } from './find-replace';
import { FindReplaceBar } from './find-replace-bar';
import { FontSizeShortcuts } from './font';
import { useImageUpload, handleImageFile } from './image-upload';
import { mentionSuggestion } from './mention-suggestion';
import { OutlinePanel } from './outline-panel';
import { Pagination } from './pagination';
import { printDocument } from './print';
import { DocToolbar } from './toolbar';
import { TableControlsBar } from './table-controls-bar';
import { PageSetupDialog, PAPER_SIZES, type PaperSize } from './page-setup-dialog';
import { VoiceTypingWidget } from './voice-typing-widget';
import { useCollaboration } from './use-collaboration';
import { VersionsPanel } from './versions-panel';
import { WordCountDialog } from './word-count-dialog';

const OUTLINE_KEY = 'qub.docs.outline';
const readOutlinePref = () => {
  try {
    return localStorage.getItem(OUTLINE_KEY) === '1';
  } catch {
    return false;
  }
};

export function DocPage() {
  const { documentId } = useParams({ from: '/_authenticated/docs/$documentId' });
  const doc = useQuery({ queryKey: qk.docs.one(documentId), queryFn: () => docsService.get(documentId) });
  if (doc.isLoading) return <FullPageSpinner label="Opening document…" />;
  if (doc.error) return <ErrorState error={doc.error} onRetry={() => void doc.refetch()} title="Can’t open this document" />;
  return <DocEditor key={documentId} documentId={documentId} />;
}

function DocEditor({ documentId }: { documentId: string }) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authenticated/docs/$documentId' });
  const doc = useQuery({ queryKey: qk.docs.one(documentId), queryFn: () => docsService.get(documentId) });
  const collaborators = useQuery({ queryKey: qk.docs.collaborators(documentId), queryFn: () => docsService.collaborators(documentId) });
  const peopleRef = useRef<CollaboratorDto[]>([]);
  peopleRef.current = collaborators.data ?? [];

  const refreshComments = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.docs.comments(documentId) });
    void qc.invalidateQueries({ queryKey: qk.docs.suggestions(documentId) });
  }, [qc, documentId]);
  const collab = useCollaboration(documentId, refreshComments);

  const [panel, setPanel] = useState<'comments' | null>(search.comment ? 'comments' : null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [showRuler, setShowRuler] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('bottom');
  const [margins, setMargins] = useState({ left: 96, right: 96 });
  const [pageConfig, setPageConfig] = useState<any>({ orientation: 'portrait', paperSize: 'letter', pageColor: '#ffffff' });
  const pageHeight = pageConfig.orientation === 'landscape'
    ? PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitWidth ?? 816
    : PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitHeight ?? 1056;
  const pageWidth = pageConfig.orientation === 'landscape'
    ? PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitHeight ?? 1056
    : PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitWidth ?? 816;
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [find, setFind] = useState<{ replace: boolean; nonce: number } | null>(null);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(readOutlinePref);
  const [pageStack, setPageStack] = useState<HTMLDivElement | null>(null);
  const toggleOutline = useCallback(() => {
    setOutlineOpen((open) => {
      try {
        localStorage.setItem(OUTLINE_KEY, open ? '0' : '1');
      } catch {
        /* preference only */
      }
      return !open;
    });
  }, []);
  const openFind = useCallback((replace: boolean) => setFind((f) => ({ replace, nonce: (f?.nonce ?? 0) + 1 })), []);

  const serverRole = doc.data?.capabilities.role ?? 'VIEWER';
  const role = collab.role ?? serverRole;
  const canEdit = roleAtLeast(role, 'EDITOR') && !doc.data?.isTrashed;
  const canComment = roleAtLeast(role, 'COMMENTER') && !doc.data?.isTrashed;

  const editor = useEditor(
    {
      extensions: collab.provider
        ? [
            ...documentExtensions({ collaborative: true, mention: { suggestion: mentionSuggestion(() => peopleRef.current) } }),
            ImageResize,
            Collaboration.configure({ document: collab.ydoc, field: 'default' }),
            CollaborationCaret.configure({ provider: collab.provider, user: { id: me.id, name: me.name, color: presenceColor(me.id), avatarUrl: me.avatarUrl } }),
            Placeholder.configure({ placeholder: 'Start typing…' }),
            Pagination,
            FindReplace,
            FontSizeShortcuts,
            CommentHighlights.configure({ ydoc: collab.ydoc, onActivate: (id) => { setActiveAnchor(id); setPanel('comments'); } }),
          ]
        : // Until the collaboration provider exists the editor is an empty, read-only placeholder; it is recreated with collaboration.
          documentExtensions(),
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: 'qub-editor', spellcheck: 'true', 'aria-label': 'Document body', role: 'textbox', 'aria-multiline': 'true' },
        handleDrop: (view, event, slice, moved) => {
          if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const file = event.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coordinates) {
                view.dispatch(view.state.tr.setSelection((view.state.selection.constructor as any).near(view.state.doc.resolve(coordinates.pos))));
              }
              if (editor) {
                void handleImageFile(file, editor, documentId);
              }
              return true;
            }
          }
          return false;
        },
        handlePaste: (view, event) => {
          if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
            const file = event.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              if (editor) {
                void handleImageFile(file, editor, documentId);
              }
              return true;
            }
          }
          return false;
        },
      },
    },
    [collab.provider],
  );

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  const liveWordCount = useMemo(() => {
    if (!editor) return 0;
    try {
      const { doc } = editor.state;
      return textStats(extractPlainText(doc.toJSON())).words;
    } catch {
      return 0;
    }
  }, [editor, editor?.state.doc]);

  // Highlight unresolved comment anchors (and the active one).
  const comments = useQuery({ queryKey: qk.docs.comments(documentId), queryFn: () => docsService.comments(documentId) });
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const visible = new Set((comments.data ?? []).filter((c) => !c.resolved).map((c) => c.anchorId));
    if (draft) visible.add(draft.anchorId);
    setAnchorView(editor, { visible, active: activeAnchor ?? draft?.anchorId ?? null });
  }, [editor, comments.data, activeAnchor, draft, collab.synced]);

  useEffect(() => {
    if (search.comment && comments.data) {
      const c = comments.data.find((x) => x.id === search.comment);
      if (c) setActiveAnchor(c.anchorId);
    }
  }, [search.comment, comments.data]);

  const startComment = useCallback(() => {
    if (!editor || !canComment || editor.state.selection.empty) return;
    const anchorId = randomId(20);
    const created = createAnchor(editor, collab.ydoc, anchorId);
    if (!created) return;
    setDraft({ anchorId, quotedText: created.quotedText });
    setPanel('comments');
  }, [editor, canComment, collab.ydoc]);

  /** Prints only the document (never the app around it); the owner can turn printing off with downloading. */
  const print = () => {
    if (!editor || !doc.data) return;
    if (!doc.data.capabilities.canDownload) return void toast.error('Printing is turned off for this document.');
    void printDocument(editor, doc.data.title);
  };
  const printRef = useRef(print);
  printRef.current = print;

  // Document shortcuts. Ctrl+Alt+M adds a comment (explicit action — no floating button on plain selection);
  // Ctrl+F / Ctrl+H open find / find and replace instead of the browser's find; Ctrl+P prints the document only.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (!e.altKey && !e.shiftKey && key === 'p') {
        e.preventDefault();
        printRef.current();
      } else if (e.altKey && key === 'm') {
        e.preventDefault();
        startComment();
      } else if (!e.altKey && !e.shiftKey && key === 'f') {
        e.preventDefault();
        openFind(false);
      } else if (!e.altKey && !e.shiftKey && key === 'h') {
        e.preventDefault();
        openFind(true);
      } else if (e.shiftKey && !e.altKey && key === 'c') {
        e.preventDefault();
        setWordCountOpen(true);
      } else if (e.altKey && key === 'a' && window.innerWidth >= 1024) {
        e.preventDefault();
        toggleOutline();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startComment, openFind, toggleOutline]);

  const rename = useMutation({
    mutationFn: (title: string) => docsService.rename(documentId, title),
    onSuccess: (d) => {
      qc.setQueryData(qk.docs.one(documentId), d);
      void qc.invalidateQueries({ queryKey: qk.drive.all });
    },
  });
  const trash = useMutation({
    mutationFn: () => docsService.trash(documentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.drive.all });
      void navigate({ to: '/drive' });
    },
  });

  const d = doc.data!;
  if (collab.fatal) return <ErrorState error={new Error(collab.fatal)} title="Document unavailable" />;

  return (
    <div className="flex h-full flex-col bg-surface-2 print:block print:h-auto print:bg-white">
      <div className="bg-background shadow-[0_1px_0_#dadce0] print:hidden">
        <EditorHeader
          fileType="DOCUMENT"
          title={d.title}
          onRename={(t) => rename.mutateAsync(t)}
          canEdit={canEdit}
          status={<SaveIndicator status={collab.saveState} lastSavedAt={collab.lastSavedAt} />}
          readOnlyLabel={canEdit ? undefined : canComment ? 'Can comment' : 'View only'}
          presence={collab.users.map((u) => ({ key: u.clientId, name: u.name, avatarUrl: u.avatarUrl, color: u.color }))}
          onShare={() => setShareOpen(true)}
          menus={
            editor ? (
              <DocMenusWithImage
                editor={editor}
                documentId={documentId}
                title={d.title}
                canEdit={canEdit}
                canComment={canComment}
                canTrash={d.capabilities.canTrash}
                canDownload={d.capabilities.canDownload}
                outlineOpen={outlineOpen}
                showRuler={showRuler}
                onToggleRuler={() => setShowRuler((r) => !r)}
                onVersionHistory={() => setVersionsOpen(true)}
                onPageSetup={() => setPageSetupOpen(true)}
                onOrientationChange={(orient) => setPageConfig((prev: any) => ({ ...prev, orientation: orient }))}
                onTogglePageNumbers={() => setShowPageNumbers((v) => !v)}
                showPageNumbers={showPageNumbers}
                onVoiceTyping={() => setVoiceOpen((v) => !v)}
                onMove={() => setMoveOpen(true)}
                onTrash={() => trash.mutate()}
                onFind={openFind}
                onToggleOutline={toggleOutline}
                onWordCount={() => setWordCountOpen(true)}
                onComment={startComment}
                onPrint={print}
              />
            ) : null
          }
          actions={
            <>
              <Tooltip content="Version history">
                <Button variant="subtle" size="icon" onClick={() => setVersionsOpen(true)} aria-label="Version history">
                  <History />
                </Button>
              </Tooltip>
              <Tooltip content="Comments">
                <Button variant="subtle" size="icon" onClick={() => setPanel((p) => (p ? null : 'comments'))} aria-pressed={panel === 'comments'} aria-label="Open comments">
                  <MessageSquare />
                </Button>
              </Tooltip>
            </>
          }
        />
        <div className="pb-2">{editor && <DocToolbar editor={editor} documentId={documentId} canEdit={canEdit} canComment={canComment} onComment={startComment} onPrint={d.capabilities.canDownload ? print : undefined} onVoiceTyping={() => setVoiceOpen((v) => !v)} voiceActive={voiceOpen} />}
          {editor && <div className="flex justify-center"><TableControlsBar editor={editor} /></div>}</div>
        {editor && (
          <button
            type="button"
            onClick={() => setWordCountOpen(true)}
            className="fixed bottom-4 left-6 z-30 flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-sm hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Click to view detailed word & character count"
          >
            <span className="tabular-nums font-semibold text-blue-600 dark:text-blue-400">{liveWordCount.toLocaleString()}</span>
            <span>{liveWordCount === 1 ? 'word' : 'words'}</span>
          </button>
        )}
      </div>
      {d.isTrashed && <div className="bg-[#fef7e0] px-4 py-2 text-center text-sm print:hidden">This document is in the trash. Restore it from Drive to keep editing.</div>}

      <div className="relative flex min-h-0 flex-1 print:block overflow-hidden">
        {find && editor && (
          <FindReplaceBar editor={editor} canReplace={canEdit} showReplace={find.replace} focusNonce={find.nonce} onClose={() => setFind(null)} />
        )}
        {outlineOpen && editor && <OutlinePanel editor={editor} scrollRoot={pageStack} onClose={toggleOutline} />}
        <div ref={setPageStack} className={cn('qub-page-stack min-w-0 flex-1 overflow-y-auto print:overflow-visible', !d.capabilities.canDownload && 'qub-no-print')} onClick={(e) => e.target === e.currentTarget && editor?.commands.focus('end')}>
          {showRuler && (
            <div className="sticky top-0 z-10 pt-2 pb-1 bg-surface-2 print:hidden flex justify-center">
              <HorizontalRuler
                width={pageWidth}
                leftMargin={margins.left}
                rightMargin={margins.right}
                onChangeMargins={(left, right) => setMargins({ left, right })}
              />
            </div>
          )}
          
          <div className="flex items-start justify-center gap-2 my-4 lg:my-6 print:m-0">
            {showRuler && (
              <div className="sticky top-12 print:hidden">
                <VerticalRuler height={pageHeight} topMargin={margins.left} bottomMargin={margins.right} />
              </div>
            )}
            <div
              style={{
                width: `${pageWidth}px`,
                maxWidth: `${pageWidth}px`,
                minHeight: `${pageHeight}px`,
                paddingLeft: `${margins.left}px`,
                paddingRight: `${margins.right}px`,
                backgroundColor: pageConfig.pageColor || '#ffffff',
              }}
              className={cn('shadow-card transition-all duration-200', 'py-8 min-[900px]:py-[96px]', 'print:m-0 print:max-w-none print:p-0 print:shadow-none')}
            >
              {!collab.synced && !editor?.getText() && <p className="text-sm text-muted print:hidden">Connecting…</p>}
              <EditorContent editor={editor} />
              {showPageNumbers && (
                <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-400 select-none print:block">
                  Page 1
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant in Sidebar Mode */}
        {editor && canEdit && aiMode === 'sidebar' && (
          <FloatingAiBar
            editor={editor}
            mode={aiMode}
            onModeChange={setAiMode}
          />
        )}

        {panel === 'comments' && editor && (
          <div className="contents print:hidden">
            <CommentsPanel
              documentId={documentId}
              editor={editor}
              ydoc={collab.ydoc}
              draft={draft}
              onDraftDone={() => setDraft(null)}
              activeAnchor={activeAnchor}
              onActivate={setActiveAnchor}
              canComment={canComment}
              canEdit={canEdit}
              people={collaborators.data ?? []}
              onClose={() => setPanel(null)}
            />
          </div>
        )}
      </div>

      {/* Floating AI Assistant in Bottom Pill or FAB Mode */}
      {editor && canEdit && aiMode !== 'sidebar' && (
        <FloatingAiBar
          editor={editor}
          mode={aiMode}
          onModeChange={setAiMode}
        />
      )}

      {editor && <WordCountDialog editor={editor} open={wordCountOpen} onOpenChange={setWordCountOpen} />}
      {versionsOpen && <VersionsPanel documentId={documentId} canEdit={canEdit} onClose={() => setVersionsOpen(false)} />}
      <ShareDialog target={shareOpen ? { kind: 'file', id: d.fileId, name: d.title } : null} onOpenChange={setShareOpen} />
      {editor && <VoiceTypingWidget editor={editor} isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />}
      <PageSetupDialog open={pageSetupOpen} onOpenChange={setPageSetupOpen} config={pageConfig} onSave={setPageConfig} />
      <MoveDialog items={moveOpen ? [{ kind: 'file', id: d.fileId, name: d.title }] : null} onOpenChange={setMoveOpen} />
    </div>
  );
}

/** The menu bar plus the hidden file input behind Insert → Image (the upload hook needs a live editor). */
function DocMenusWithImage({ documentId, ...props }: Omit<DocMenusProps, 'onInsertImage'> & { documentId: string }) {
  const image = useImageUpload(props.editor, documentId);
  return (
    <>
      <DocMenus {...props} onInsertImage={image.pick} />
      {image.input}
    </>
  );
}
