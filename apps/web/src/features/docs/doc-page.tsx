import ImageResize from 'tiptap-extension-resize-image';
import { HorizontalRuler } from './doc-ruler';
import { VerticalRuler } from './vertical-ruler';
import { FloatingAiBar, type AiMode } from './floating-ai-bar';
import { extractPlainText, textStats, markdownToHtml } from '@qub/editor-schema';
import type { CollaboratorDto } from '@qub/shared';
import { roleAtLeast } from '@qub/shared';
import { documentExtensions } from '@qub/editor-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { History, MessageSquare, Presentation, Minus, Plus, SeparatorHorizontal } from 'lucide-react';
import { DocSlidesPresenter } from './doc-slides-presenter';
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
import { getServiceUrl } from '@/lib/ecosystem-urls';
import { setPageMetadata } from '@/lib/meta';
import { ShareDialog } from '../sharing/share-dialog';
import { RequestAccessDialog } from '../sharing/request-access-dialog';
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
import { PageSetupDialog, PAPER_SIZES, type PageSetupConfig, type PaperSize } from './page-setup-dialog';
import { ImageControlsBar } from './image-controls-bar';
import { InDocHandwriting } from './in-doc-handwriting';
import { HeaderFooterDialog } from './header-footer-dialog';
import { MobileInsertTableDialog } from './mobile-insert-table-dialog';
import { SpellingGrammarPanel } from './spelling-grammar/spelling-grammar-panel';
import { PasswordProtectionDialog } from '../security/password-protection-dialog';
import { DocumentLockScreen } from '../security/document-lock-screen';
import { documentProtection } from '../security/document-protection';
import { CheckCheck, PenTool, Layers, Table2, Shield, Lock, Smartphone } from 'lucide-react';
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

  useEffect(() => {
    if (doc.data?.title) {
      setPageMetadata({
        title: doc.data.title,
        suiteName: 'Docs',
        description: 'Collaborate on this document in real time with Qub Docs',
      });
    }
  }, [doc.data?.title]);
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

  useEffect(() => {
    if (doc.data?.title) {
      setPageMetadata({
        title: doc.data.title,
        suiteName: 'Docs',
        description: 'Collaborate on this document in real time with Qub Docs',
      });
    }
  }, [doc.data?.title]);
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
  const [zoomLevel, setZoomLevel] = useState<'fit' | number>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'fit' : 100);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = viewportWidth < 768;

  const [pageConfig, setPageConfig] = useState<PageSetupConfig>({
    orientation: 'portrait',
    paperSize: 'letter',
    pageColor: '#ffffff',
    columns: 1,
    pageless: false,
    watermark: '',
    headerText: '',
    footerText: '',
    showPageNumbers: false,
  });
  const pageHeight = pageConfig.orientation === 'landscape'
    ? PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitWidth ?? 816
    : PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitHeight ?? 1056;
  const pageWidth = pageConfig.pageless
    ? 1160
    : pageConfig.orientation === 'landscape'
      ? PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitHeight ?? 1056
      : PAPER_SIZES[pageConfig.paperSize as PaperSize]?.portraitWidth ?? 816;

  const effectiveScale = useMemo(() => {
    if (pageConfig.pageless) return 1;
    if (!isMobile) {
      return typeof zoomLevel === 'number' ? zoomLevel / 100 : 1;
    }
    if (zoomLevel === 'fit') {
      const available = Math.max(280, viewportWidth - 20);
      return Math.min(1, Math.round((available / pageWidth) * 100) / 100);
    }
    return zoomLevel / 100;
  }, [pageConfig.pageless, zoomLevel, isMobile, viewportWidth, pageWidth]);
  const [shareOpen, setShareOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [spellingOpen, setSpellingOpen] = useState(false);
  const [handwritingOpen, setHandwritingOpen] = useState(false);
  const [headerFooterOpen, setHeaderFooterOpen] = useState(false);
  const [insertTableOpen, setInsertTableOpen] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => documentProtection.isSessionUnlocked(documentId));
  const isProtected = documentProtection.get(documentId)?.enabled ?? false;
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [find, setFind] = useState<{ replace: boolean; nonce: number } | null>(null);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeDragRef = useRef<{
    active: boolean;
    imgEl: HTMLImageElement;
    pos: number;
    startX: number;
    startY: number;
    baseOx: number;
    baseOy: number;
    currentOx: number;
    currentOy: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const handleEditorTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !editor) return;
    const touch = e.touches[0]!;
    const target = e.target as HTMLElement;
    const img = target.closest('img') as HTMLImageElement | null;
    if (!img) return;

    const pos = editor.view.posAtDOM(img, 0);
    if (typeof pos === 'number' && pos >= 0) {
      editor.commands.setNodeSelection(pos);
    }

    const baseOx = Number(img.getAttribute('data-offset-x') || 0);
    const baseOy = Number(img.getAttribute('data-offset-y') || 0);

    freeDragRef.current = {
      active: false,
      imgEl: img,
      pos: typeof pos === 'number' ? pos : -1,
      startX: touch.clientX,
      startY: touch.clientY,
      baseOx,
      baseOy,
      currentOx: baseOx,
      currentOy: baseOy,
      lastX: touch.clientX,
      lastY: touch.clientY,
    };

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const drag = freeDragRef.current;
      if (!drag) return;
      drag.active = true;
      try {
        navigator.vibrate?.(30);
      } catch {}
      drag.imgEl.style.zIndex = '50';
      drag.imgEl.style.boxShadow = '0 20px 30px rgba(37, 99, 235, 0.35)';
      drag.imgEl.style.outline = '2.5px solid #2563eb';
      drag.imgEl.style.transition = 'none';
    }, 220);
  };

  const handleEditorTouchMove = (e: React.TouchEvent) => {
    const drag = freeDragRef.current;
    if (!drag || e.touches.length !== 1) return;
    const touch = e.touches[0]!;

    if (!drag.active) {
      if (Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY) > 12) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        freeDragRef.current = null;
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const scale = effectiveScale || 1;
    const dx = (touch.clientX - drag.startX) / scale;
    const dy = (touch.clientY - drag.startY) / scale;
    drag.currentOx = drag.baseOx + dx;
    drag.currentOy = drag.baseOy + dy;
    drag.lastX = touch.clientX;
    drag.lastY = touch.clientY;

    drag.imgEl.style.position = 'relative';
    drag.imgEl.style.transform = `translate3d(${Math.round(drag.currentOx)}px, ${Math.round(drag.currentOy)}px, 0)`;

    // Auto-scroll pageStack when dragging near top or bottom of screen
    if (pageStack) {
      if (touch.clientY < 110) {
        pageStack.scrollTop -= 12;
      } else if (touch.clientY > window.innerHeight - 110) {
        pageStack.scrollTop += 12;
      }
    }
  };

  const handleEditorTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const drag = freeDragRef.current;
    freeDragRef.current = null;
    if (!drag || !drag.active || !editor) return;

    drag.imgEl.style.zIndex = '';
    drag.imgEl.style.boxShadow = '';
    drag.imgEl.style.outline = '';
    drag.imgEl.style.transition = '';

    if (drag.pos >= 0) {
      editor
        .chain()
        .setNodeSelection(drag.pos)
        .updateAttributes('image', {
          offsetX: Math.round(drag.currentOx),
          offsetY: Math.round(drag.currentOy),
        })
        .run();
    }
  };
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(readOutlinePref);
  const initialPinchDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(100);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        initialPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialZoom.current = typeof zoomLevel === 'number' ? zoomLevel : Math.round(effectiveScale * 100);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDist.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = currentDist / initialPinchDist.current;
        const newZoom = Math.min(250, Math.max(30, Math.round(initialZoom.current * ratio)));
        setZoomLevel(newZoom);
      }
    }
  };

  const handleTouchEnd = () => {
    initialPinchDist.current = null;
  };

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setSlidesOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const serverRole = doc.data?.capabilities.role ?? 'VIEWER';
  const role = collab.role ?? serverRole;
  const canEdit = roleAtLeast(role, 'EDITOR') && !doc.data?.isTrashed;
  const canComment = roleAtLeast(role, 'COMMENTER') && !doc.data?.isTrashed;
  const canShare = doc.data?.capabilities.canShare ?? false;

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
        : documentExtensions(),
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: 'qub-editor', spellcheck: 'true', 'aria-label': 'Document body', role: 'textbox', 'aria-multiline': 'true' },
        handleDrop: (view, event, _slice, moved) => {
          if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const file = event.dataTransfer.files[0];
            if (!file) return false;
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
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext === 'md' || ext === 'markdown') {
              event.preventDefault();
              void file.text().then((text) => {
                const html = markdownToHtml(text);
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordinates) {
                  view.dispatch(view.state.tr.setSelection((view.state.selection.constructor as any).near(view.state.doc.resolve(coordinates.pos))));
                }
                editor?.commands.insertContent(html);
                toast.success(`Inserted markdown from ${file.name}`);
              });
              return true;
            }
            if (ext === 'txt') {
              event.preventDefault();
              void file.text().then((text) => {
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordinates) {
                  view.dispatch(view.state.tr.setSelection((view.state.selection.constructor as any).near(view.state.doc.resolve(coordinates.pos))));
                }
                editor?.commands.insertContent(text);
                toast.success(`Inserted text from ${file.name}`);
              });
              return true;
            }
          }
          return false;
        },
        handlePaste: (_view, event) => {
          if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
            const file = event.clipboardData.files[0];
            if (file && file.type.startsWith('image/')) {
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

  useEffect(() => {
    if (!collab.provider?.awareness) return;
    collab.provider.awareness.setLocalStateField('user', {
      id: me.id,
      name: me.name,
      color: presenceColor(me.id),
      avatarUrl: me.avatarUrl,
    });
  }, [collab.provider, me.name, me.id, me.avatarUrl]);

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

  const getFirstLineOfDocument = useCallback(() => {
    if (!editor) return null;
    let firstLine: string | null = null;
    editor.state.doc.descendants((node) => {
      if (firstLine !== null) return false;
      if (node.isTextblock && node.textContent.trim()) {
        firstLine = node.textContent.trim();
        return false;
      }
      return true;
    });
    return firstLine;
  }, [editor]);

  const handleShare = async () => {
    const docUrl = getServiceUrl('docs', `/docs/${documentId}`);
    try {
      await navigator.clipboard.writeText(docUrl);
      toast.success('Document link copied to clipboard');
    } catch {
      // ignore
    }
    setShareOpen(true);
  };
  if (collab.fatal) return <ErrorState error={new Error(collab.fatal)} title="Document unavailable" />;

  const displayPageNumbers = pageConfig.showPageNumbers || showPageNumbers;

  if (isProtected && !isUnlocked) {
    return (
      <DocumentLockScreen
        fileId={documentId}
        documentTitle={d?.title || 'Document'}
        itemType="Document"
        onUnlocked={() => setIsUnlocked(true)}
        onBack={() => navigate({ to: '/drive' })}
      />
    );
  }

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col bg-surface-2 print:block print:h-auto print:bg-white">
      <div className="bg-background shadow-[0_1px_0_#dadce0] print:hidden">
        <EditorHeader
          fileType="DOCUMENT"
          title={d.title}
          onRename={(t) => rename.mutateAsync(t)}
          onAutoSuggestTitle={getFirstLineOfDocument}
          canEdit={canEdit}
          status={<SaveIndicator status={collab.saveState} lastSavedAt={collab.lastSavedAt} />}
          readOnlyLabel={canEdit ? undefined : canComment ? 'Can comment' : 'View only'}
          presence={collab.users.map((u) => ({ key: u.clientId, name: u.name, avatarUrl: u.avatarUrl, color: u.color }))}
          onShare={canShare ? handleShare : undefined}
          onRequestAccess={!canShare && !canEdit ? () => setRequestAccessOpen(true) : undefined}
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
                onOrientationChange={(orient) => setPageConfig((prev) => ({ ...prev, orientation: orient }))}
                onColumnsChange={(cols) => {
                  setPageConfig((prev) => ({ ...prev, columns: cols }));
                  toast.success(`Document layout set to ${cols} ${cols === 1 ? 'column' : 'columns'}`);
                }}
                onTogglePageless={() =>
                  setPageConfig((prev) => {
                    const next = !prev.pageless;
                    toast.success(next ? 'Pageless mode enabled' : 'Print page layout enabled');
                    return { ...prev, pageless: next };
                  })
                }
                pageless={pageConfig.pageless}
                onTogglePageNumbers={() => setShowPageNumbers((v) => !v)}
                showPageNumbers={displayPageNumbers}
                onVoiceTyping={() => setVoiceOpen((v) => !v)}
                onMove={() => setMoveOpen(true)}
                onTrash={() => trash.mutate()}
                onFind={openFind}
                onToggleOutline={toggleOutline}
                onWordCount={() => setWordCountOpen(true)}
                onPresentSlides={() => setSlidesOpen(true)}
                onComment={startComment}
                onPrint={print}
                onPasswordProtection={() => setProtectionOpen(true)}
                onSpellingCheck={() => setSpellingOpen(true)}
                onHandwriting={() => setHandwritingOpen(true)}
                onHeaderFooter={() => setHeaderFooterOpen(true)}
              />
            ) : null
          }
          actions={
            <div className="flex items-center gap-1">
              <Tooltip content="Version history">
                <Button variant="subtle" size="icon" onClick={() => setVersionsOpen(true)} aria-label="Version history" className="hidden sm:inline-flex">
                  <History />
                </Button>
              </Tooltip>
              <Tooltip content="Present as slides (F5)">
                <Button variant="subtle" size="icon" onClick={() => setSlidesOpen(true)} aria-label="Present as slides" className="hidden sm:inline-flex">
                  <Presentation />
                </Button>
              </Tooltip>
              <Tooltip content="Comments">
                <Button variant="subtle" size="icon" onClick={() => setPanel((p) => (p ? null : 'comments'))} aria-pressed={panel === 'comments'} aria-label="Open comments">
                  <MessageSquare />
                </Button>
              </Tooltip>
              <Tooltip content={isProtected ? 'Document protected (click to manage)' : 'Protect document with password'}>
                <Button
                  variant={isProtected ? 'secondary' : 'subtle'}
                  size="icon"
                  onClick={() => setProtectionOpen(true)}
                  aria-label="Password protection"
                  className={cn(isProtected && 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300')}
                >
                  <Shield className="size-4" />
                </Button>
              </Tooltip>
            </div>
          }
        />
        <div className="pb-2.5 pt-1">
          {editor && (
            <DocToolbar
              editor={editor}
              documentId={documentId}
              canEdit={canEdit}
              canComment={canComment}
              onComment={startComment}
              onPrint={d.capabilities.canDownload ? print : undefined}
              onVoiceTyping={() => setVoiceOpen((v) => !v)}
              voiceActive={voiceOpen}
              onSpellingCheck={() => setSpellingOpen(true)}
              onHandwriting={() => setHandwritingOpen((h) => !h)}
              onHeaderFooter={() => setHeaderFooterOpen(true)}
              orientation={pageConfig.orientation}
              onOrientationChange={(next) => {
                setPageConfig((p) => ({ ...p, orientation: next }));
                toast.success(`Switched to ${next === 'portrait' ? 'Portrait' : 'Landscape'}`);
              }}
              paperSize={pageConfig.paperSize}
              onPaperSizeChange={(size) => {
                setPageConfig((p) => ({ ...p, paperSize: size }));
                toast.success(`Size: ${PAPER_SIZES[size]?.name || size}`);
              }}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
              effectiveScale={effectiveScale}
              pageless={pageConfig.pageless}
              showPageNumbers={displayPageNumbers || pageConfig.showPageNumbers}
              onTogglePageNumbers={() => {
                const next = !displayPageNumbers;
                setShowPageNumbers(next);
                setPageConfig((p) => ({ ...p, showPageNumbers: next }));
                toast.success(next ? 'Page numbering enabled' : 'Page numbering hidden');
              }}
              onInsertTable={() => setInsertTableOpen(true)}
              onWordCount={() => setWordCountOpen(true)}
            />
          )}

          {/* Contextual Table and Image Controls Bars */}
          {editor && (
            <div className="flex flex-col items-center justify-center">
              <ImageControlsBar editor={editor} />
              <TableControlsBar editor={editor} />
            </div>
          )}
        </div>
        {editor && (
          <button
            type="button"
            onClick={() => setWordCountOpen(true)}
            className="fixed bottom-4 left-6 z-30 hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-sm hover:bg-slate-50 hover:text-slate-900"
            title="Click to view detailed word & character count"
          >
            <span className="tabular-nums font-semibold text-blue-600">{liveWordCount.toLocaleString()}</span>
            <span>{liveWordCount === 1 ? 'word' : 'words'}</span>
          </button>
        )}
      </div>
      {d.isTrashed && (
        <div className="bg-[#fef7e0] px-4 py-2 text-center text-sm print:hidden">
          This document is in the trash. Restore it from Drive to keep editing.
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 print:block overflow-hidden">
        {find && editor && (
          <FindReplaceBar
            editor={editor}
            canReplace={canEdit}
            showReplace={find.replace}
            focusNonce={find.nonce}
            onClose={() => setFind(null)}
          />
        )}
        {outlineOpen && editor && <OutlinePanel editor={editor} scrollRoot={pageStack} onClose={toggleOutline} />}
        <div
          ref={setPageStack}
          className={cn(
            'qub-page-stack min-w-0 flex-1 overflow-auto print:overflow-visible touch-pan-x touch-pan-y',
            !d.capabilities.canDownload && 'qub-no-print'
          )}
          data-pageless={pageConfig.pageless ? 'true' : 'false'}
          style={{
            '--page-margin': `${margins.left}px`,
            '--page-gap': '24px',
          } as React.CSSProperties}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.target === e.currentTarget && editor?.commands.focus('end')}
        >
          {/* Scaled Document Canvas Wrapper */}
          <div
            className="flex flex-col items-center justify-start my-2 sm:my-4 lg:my-6 print:m-0 origin-top transition-transform duration-75"
            style={{
              zoom: effectiveScale !== 1 ? effectiveScale : undefined,
              minWidth: pageConfig.pageless ? '100%' : `${pageWidth}px`,
            }}
            onDoubleClick={() => {
              if (isMobile && !pageConfig.pageless) {
                setZoomLevel((z) => (z === 'fit' ? 100 : 'fit'));
              }
            }}
          >
            {showRuler && !pageConfig.pageless && (
              <div className="sticky top-0 z-10 pt-2 pb-1 bg-surface-2 print:hidden flex justify-center">
                <HorizontalRuler
                  width={pageWidth}
                  leftMargin={margins.left}
                  rightMargin={margins.right}
                  onChangeMargins={(left, right) => setMargins({ left, right })}
                />
              </div>
            )}

            <div className="flex items-start justify-center gap-2 print:m-0">
              {showRuler && !pageConfig.pageless && (
                <div className="sticky top-12 print:hidden hidden md:block">
                  <VerticalRuler height={pageHeight} topMargin={margins.left} bottomMargin={margins.right} />
                </div>
              )}
              <div
                style={{
                  width: pageConfig.pageless ? '100%' : `${pageWidth}px`,
                  minWidth: pageConfig.pageless ? '100%' : isMobile ? undefined : `${pageWidth}px`,
                  maxWidth: pageConfig.pageless ? '100%' : `${pageWidth}px`,
                  minHeight: pageConfig.pageless ? 'calc(100dvh - 140px)' : `${pageHeight}px`,
                  paddingLeft: pageConfig.pageless && isMobile ? '16px' : `${margins.left}px`,
                  paddingRight: pageConfig.pageless && isMobile ? '16px' : `${margins.right}px`,
                  backgroundColor: pageConfig.pageColor || '#ffffff',
                }}
                className={cn(
                  'relative transition-all duration-200 overflow-hidden',
                  pageConfig.pageless ? 'w-full rounded-2xl border border-slate-200/80 shadow-xs' : 'shadow-card',
                  'py-8 min-[900px]:py-[80px]',
                  'print:m-0 print:max-w-none print:p-0 print:shadow-none'
                )}
              >
              {/* Diagonal Page Watermark */}
              {pageConfig.watermark && (
                <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden">
                  <span className="-rotate-45 text-5xl md:text-7xl font-black uppercase tracking-[0.2em] text-slate-900/[0.05] whitespace-nowrap">
                    {pageConfig.watermark}
                  </span>
                </div>
              )}

              {/* Interactive Running Page Header */}
              <div
                onClick={() => setHeaderFooterOpen(true)}
                className="relative z-10 mb-6 pb-2 border-b border-dashed border-slate-200/80 flex items-center justify-between text-xs text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors group select-none"
                title="Click to edit header and page layout"
              >
                <span>{pageConfig.headerText || <span className="opacity-0 group-hover:opacity-100 text-[11px] italic text-slate-400">Header: click to add running header...</span>}</span>
                <span className="text-[11px] opacity-75">{d.title}</span>
              </div>

              {!collab.synced && !editor?.getText() && (
                <p className="text-sm text-muted print:hidden">Connecting…</p>
              )}

              {/* Direct Note Canvas Handwriting Layer (No Box!) */}
              <InDocHandwriting
                documentId={documentId}
                editor={editor}
                active={handwritingOpen}
                onClose={() => setHandwritingOpen(false)}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
              />

              <div
                className="relative z-10"
                onTouchStart={handleEditorTouchStart}
                onTouchMove={handleEditorTouchMove}
                onTouchEnd={handleEditorTouchEnd}
                style={
                  pageConfig.columns && pageConfig.columns > 1
                    ? {
                        columnCount: pageConfig.columns,
                        columnGap: '2.5rem',
                        columnRule: '1px solid #e2e8f0',
                      }
                    : undefined
                }
              >
                <EditorContent editor={editor} />
              </div>

              {/* Interactive Running Page Footer & Page Numbering */}
              <div
                onClick={() => setHeaderFooterOpen(true)}
                className="relative z-10 mt-12 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between text-xs text-slate-400 select-none cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors group print:flex"
                title="Click to edit footer and page numbers"
              >
                <span>{pageConfig.footerText || <span className="opacity-0 group-hover:opacity-100 text-[11px] italic text-slate-400">Footer: click to add running footer...</span>}</span>
                {(displayPageNumbers || pageConfig.showPageNumbers) && (
                  <span className="font-mono text-xs font-semibold text-slate-500">Page 1</span>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* AI Assistant in Sidebar Mode */}
        {editor && canEdit && aiMode === 'sidebar' && (
          <FloatingAiBar editor={editor} mode={aiMode} onModeChange={setAiMode} />
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
        <FloatingAiBar editor={editor} mode={aiMode} onModeChange={setAiMode} />
      )}

      {editor && <WordCountDialog editor={editor} open={wordCountOpen} onOpenChange={setWordCountOpen} />}
      {versionsOpen && (
        <VersionsPanel documentId={documentId} canEdit={canEdit} onClose={() => setVersionsOpen(false)} />
      )}
      {editor && slidesOpen && (
        <DocSlidesPresenter
          docContent={editor.getJSON()}
          docTitle={d.title}
          isOpen={slidesOpen}
          onClose={() => setSlidesOpen(false)}
        />
      )}
      <ShareDialog
        target={
          shareOpen
            ? {
                kind: 'file',
                id: d.fileId,
                name: d.title,
                customCopyUrl: getServiceUrl('docs', `/docs/${documentId}`),
                copyButtonLabel: 'Copy document link',
              }
            : null
        }
        onOpenChange={setShareOpen}
      />
      <RequestAccessDialog
        target={
          requestAccessOpen
            ? {
                kind: 'file',
                id: d.fileId,
                name: d.title,
              }
            : null
        }
        onOpenChange={setRequestAccessOpen}
      />
      {editor && <VoiceTypingWidget editor={editor} isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />}
      <PageSetupDialog open={pageSetupOpen} onOpenChange={setPageSetupOpen} config={pageConfig} onSave={setPageConfig} />
      <MoveDialog items={moveOpen ? [{ kind: 'file', id: d.fileId, name: d.title }] : null} onOpenChange={setMoveOpen} />

      <HeaderFooterDialog
        open={headerFooterOpen}
        onOpenChange={setHeaderFooterOpen}
        config={{
          headerText: pageConfig.headerText || '',
          footerText: pageConfig.footerText || '',
          headerAlignment: 'center',
          footerAlignment: 'center',
          showPageNumbers: displayPageNumbers,
          differentFirstPage: false,
        }}
        onSave={(cfg) => {
          setPageConfig((p) => ({ ...p, headerText: cfg.headerText, footerText: cfg.footerText, showPageNumbers: cfg.showPageNumbers }));
          setShowPageNumbers(cfg.showPageNumbers);
        }}
      />
      <MobileInsertTableDialog open={insertTableOpen} onOpenChange={setInsertTableOpen} editor={editor} />
      <SpellingGrammarPanel editor={editor} open={spellingOpen} onOpenChange={setSpellingOpen} />
      <PasswordProtectionDialog
        open={protectionOpen}
        onOpenChange={setProtectionOpen}
        fileId={documentId}
        documentTitle={d.title}
        itemType="document"
        onProtectionChanged={(prot) => {
          if (!prot) setIsUnlocked(true);
        }}
      />
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
