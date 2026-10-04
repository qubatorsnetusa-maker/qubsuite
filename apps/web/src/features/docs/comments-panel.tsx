import type { CollaboratorDto, CommentDto, SuggestionDto } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { Check, MoreVertical, RotateCcw, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { cn, formatRelative } from '@/lib/utils';
import { docsService } from '@/services/docs';
import { qk } from '@/services/query-keys';
import { removeAnchor, resolveAnchor } from './comment-anchors';

export interface Draft {
  anchorId: string;
  quotedText: string;
}

/** Textarea with @mention autocomplete over people who can access the document. */
function MentionTextarea({ value, onChange, people, onMentions, placeholder, autoFocus, onSubmit }: { value: string; onChange(v: string): void; people: CollaboratorDto[]; onMentions(ids: string[]): void; placeholder: string; autoFocus?: boolean; onSubmit(): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const matches = query === null ? [] : people.filter((p) => p.user.name.toLowerCase().includes(query.toLowerCase()) || p.user.email.includes(query.toLowerCase())).slice(0, 6);

  const update = (text: string) => {
    onChange(text);
    const caret = ref.current?.selectionStart ?? text.length;
    const m = /@([\w.-]*)$/.exec(text.slice(0, caret));
    setQuery(m ? m[1]! : null);
    // Keep only mentions whose @Name is still in the text.
    const ids = [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([id]) => id);
    onMentions(ids);
  };
  const choose = (p: CollaboratorDto) => {
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\w.-]*)$/, `@${p.user.name} `);
    const text = before + value.slice(caret);
    const next = new Map(picked).set(p.user.id, p.user.name);
    setPicked(next);
    setQuery(null);
    onChange(text);
    onMentions([...next].filter(([, n]) => text.includes(`@${n}`)).map(([id]) => id));
    requestAnimationFrame(() => ref.current?.focus());
  };
  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-16 text-sm"
        onKeyDown={(e) => {
          if (matches.length && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            choose(matches[0]!);
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          } else if (e.key === 'Escape') setQuery(null);
        }}
        aria-label={placeholder}
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-background py-1 shadow-pop">
          {matches.map((p) => (
            <li key={p.user.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); choose(p); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-hover">
                <Avatar user={p.user} size={22} /> {p.user.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ submitLabel, people, onSubmit, onCancel, initial = '', autoFocus }: { submitLabel: string; people: CollaboratorDto[]; onSubmit(body: string, mentions: string[]): Promise<unknown>; onCancel?(): void; initial?: string; autoFocus?: boolean }) {
  const [body, setBody] = useState(initial);
  const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onSubmit(body.trim(), mentions);
      setBody('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <MentionTextarea value={body} onChange={setBody} people={people} onMentions={setMentions} placeholder="Comment or add others with @" autoFocus={autoFocus} onSubmit={() => void submit()} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={() => void submit()} loading={busy} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Thread({ c, documentId, active, onActivate, people, canComment, canModerate }: { c: CommentDto; documentId: string; active: boolean; onActivate(): void; people: CollaboratorDto[]; canComment: boolean; canModerate: boolean }) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.docs.comments(documentId) });
  const [editing, setEditing] = useState<string | null>(null);
  const resolve = useMutation({ mutationFn: (r: boolean) => docsService.resolveComment(documentId, c.id, r), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => docsService.deleteComment(documentId, c.id), onSuccess: refresh });
  return (
    <article
      onClick={onActivate}
      className={cn('cursor-default rounded-xl border bg-background p-3 text-sm transition-shadow', active ? 'border-transparent shadow-pop' : 'border-border hover:shadow-card', c.resolved && 'opacity-70')}
      aria-label={`Comment by ${c.author.name}`}
    >
      <header className="flex items-start gap-2">
        <Avatar user={c.author} size={32} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{c.author.name}</p>
          <p className="text-xs text-muted">
            {formatRelative(c.createdAt)} {c.editedAt && '· edited'}
          </p>
        </div>
        {canComment && (
          <Button variant="subtle" size="icon-sm" onClick={(e) => { e.stopPropagation(); resolve.mutate(!c.resolved); }} aria-label={c.resolved ? 'Reopen' : 'Resolve'}>
            {c.resolved ? <RotateCcw /> : <Check className="text-primary" />}
          </Button>
        )}
        {(c.author.id === me.id || canModerate) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle" size="icon-sm" aria-label="Comment actions" onClick={(e) => e.stopPropagation()}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {c.author.id === me.id && <DropdownMenuItem onSelect={() => setEditing(c.id)}>Edit</DropdownMenuItem>}
              <DropdownMenuItem destructive onSelect={() => remove.mutate()}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {c.quotedText && <blockquote className="mt-2 border-l-2 border-[#fbbc04] pl-2 text-xs text-muted line-clamp-2">{c.quotedText}</blockquote>}
      {editing === c.id ? (
        <div className="mt-2">
          <Composer
            submitLabel="Save"
            people={people}
            initial={c.body}
            autoFocus
            onCancel={() => setEditing(null)}
            onSubmit={async (body, mentions) => {
              await docsService.updateComment(documentId, c.id, { body, mentions });
              setEditing(null);
              await refresh();
            }}
          />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words">{c.body}</p>
      )}
      {c.resolved && c.resolvedBy && <p className="mt-2 text-xs text-muted">Resolved by {c.resolvedBy.name}</p>}
      {c.replies.map((r) => (
        <div key={r.id} className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Avatar user={r.author} size={24} />
            <span className="font-medium">{r.author.name}</span>
            <span className="text-xs text-muted">{formatRelative(r.createdAt)}</span>
            {(r.author.id === me.id || canModerate) && (
              <button className="ml-auto text-xs text-muted hover:text-danger" onClick={async (e) => { e.stopPropagation(); await docsService.deleteReply(documentId, c.id, r.id); await refresh(); }}>
                Delete
              </button>
            )}
          </div>
          {editing === r.id ? (
            <Composer submitLabel="Save" people={people} initial={r.body} onCancel={() => setEditing(null)} onSubmit={async (body, mentions) => { await docsService.updateReply(documentId, c.id, r.id, { body, mentions }); setEditing(null); await refresh(); }} />
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words" onDoubleClick={() => r.author.id === me.id && setEditing(r.id)}>
              {r.body}
            </p>
          )}
        </div>
      ))}
      {active && canComment && (
        <div className="mt-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
          <Composer submitLabel="Reply" people={people} onSubmit={async (body, mentions) => { await docsService.reply(documentId, c.id, { body, mentions }); await refresh(); }} />
        </div>
      )}
    </article>
  );
}

function SuggestionCard({ s, documentId, editor, ydoc, canEdit }: { s: SuggestionDto; documentId: string; editor: Editor; ydoc: Y.Doc; canEdit: boolean }) {
  const qc = useQueryClient();
  const decide = useMutation({
    mutationFn: async (accept: boolean) => {
      if (accept) {
        const range = resolveAnchor(editor, ydoc, s.anchorId);
        if (!range) throw new Error('The suggested text no longer exists in the document.');
        // Applied inside the collaborative document so it merges with everyone's concurrent edits.
        editor.chain().focus().insertContentAt(range, s.suggestedText).run();
      }
      await docsService.resolveSuggestion(documentId, s.id, accept);
      removeAnchor(ydoc, s.anchorId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.docs.suggestions(documentId) }),
  });
  return (
    <article className="rounded-xl border border-border bg-background p-3 text-sm">
      <header className="flex items-center gap-2">
        <Avatar user={s.author} size={28} />
        <span className="flex-1 font-medium">{s.author.name}</span>
        <Badge tone={s.status === 'PENDING' ? 'primary' : s.status === 'ACCEPTED' ? 'success' : 'neutral'}>{s.status.toLowerCase()}</Badge>
      </header>
      <p className="mt-2">
        Replace <del className="bg-danger-soft text-danger">{s.originalText}</del> with <ins className="bg-[#e6f4ea] text-success no-underline">{s.suggestedText}</ins>
      </p>
      {s.status === 'PENDING' && (
        <div className="mt-2 flex gap-1">
          {canEdit && (
            <Button size="sm" onClick={() => decide.mutate(true)} loading={decide.isPending && decide.variables}>
              <Check /> Accept
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => decide.mutate(false)} loading={decide.isPending && !decide.variables}>
            <X /> Reject
          </Button>
        </div>
      )}
    </article>
  );
}

export function CommentsPanel({
  documentId,
  editor,
  ydoc,
  draft,
  onDraftDone,
  activeAnchor,
  onActivate,
  canComment,
  canEdit,
  people,
  onClose,
}: {
  documentId: string;
  editor: Editor;
  ydoc: Y.Doc;
  draft: Draft | null;
  onDraftDone(): void;
  activeAnchor: string | null;
  onActivate(anchorId: string | null): void;
  canComment: boolean;
  canEdit: boolean;
  people: CollaboratorDto[];
  onClose(): void;
}) {
  const qc = useQueryClient();
  const comments = useQuery({ queryKey: qk.docs.comments(documentId), queryFn: () => docsService.comments(documentId) });
  const suggestions = useQuery({ queryKey: qk.docs.suggestions(documentId), queryFn: () => docsService.suggestions(documentId) });
  const [mode, setMode] = useState<'comment' | 'suggest'>('comment');
  const [suggestion, setSuggestion] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Order threads by where their anchor currently sits in the document.
  const ordered = useMemo(() => {
    const list = (comments.data ?? []).filter((c) => showResolved || !c.resolved);
    const pos = (c: CommentDto) => resolveAnchor(editor, ydoc, c.anchorId)?.from ?? Number.MAX_SAFE_INTEGER;
    return list.sort((a, b) => pos(a) - pos(b));
  }, [comments.data, editor, ydoc, showResolved]);

  const cancelDraft = () => {
    if (draft) removeAnchor(ydoc, draft.anchorId);
    onDraftDone();
  };

  return (
    <aside className="flex w-full flex-col border-l border-border bg-surface sm:w-[340px]" aria-label="Comments">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="font-medium">Comments</h2>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Resolved
          </label>
          <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Close comments">
            <X />
          </Button>
        </div>
      </header>
      <Tabs defaultValue="comments" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-2">
          <TabsTrigger value="comments">Comments {comments.data ? `(${comments.data.filter((c) => !c.resolved).length})` : ''}</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions {suggestions.data ? `(${suggestions.data.filter((s) => s.status === 'PENDING').length})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {draft && (
            <div className="rounded-xl bg-background p-3 shadow-pop">
              <blockquote className="mb-2 border-l-2 border-[#fbbc04] pl-2 text-xs text-muted line-clamp-3">{draft.quotedText}</blockquote>
              <div className="mb-2 flex gap-1 text-xs" role="radiogroup" aria-label="Comment type">
                <button role="radio" aria-checked={mode === 'comment'} className={cn('rounded-full px-3 py-1', mode === 'comment' ? 'bg-primary-soft' : 'hover:bg-hover')} onClick={() => setMode('comment')}>
                  Comment
                </button>
                <button role="radio" aria-checked={mode === 'suggest'} className={cn('rounded-full px-3 py-1', mode === 'suggest' ? 'bg-primary-soft' : 'hover:bg-hover')} onClick={() => setMode('suggest')}>
                  Suggest edit
                </button>
              </div>
              {mode === 'comment' ? (
                <Composer
                  submitLabel="Comment"
                  autoFocus
                  people={people}
                  onCancel={cancelDraft}
                  onSubmit={async (body, mentions) => {
                    const created = await docsService.createComment(documentId, { anchorId: draft.anchorId, quotedText: draft.quotedText, body, mentions });
                    onDraftDone();
                    onActivate(created.anchorId);
                    await qc.invalidateQueries({ queryKey: qk.docs.comments(documentId) });
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <Textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Replace with…" autoFocus aria-label="Suggested replacement" />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelDraft}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await docsService.createSuggestion(documentId, { anchorId: draft.anchorId, originalText: draft.quotedText, suggestedText: suggestion });
                        setSuggestion('');
                        onDraftDone();
                        await qc.invalidateQueries({ queryKey: qk.docs.suggestions(documentId) });
                      }}
                    >
                      Suggest
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {ordered.map((c) => (
            <Thread key={c.id} c={c} documentId={documentId} active={activeAnchor === c.anchorId} onActivate={() => onActivate(c.anchorId)} people={people} canComment={canComment} canModerate={canEdit} />
          ))}
          {!draft && ordered.length === 0 && !comments.isLoading && (
            <p className="px-2 py-8 text-center text-sm text-muted">No comments yet. Select text and press the comment button{canComment ? '' : ' (commenter access required)'}.</p>
          )}
        </TabsContent>
        <TabsContent value="suggestions" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {(suggestions.data ?? []).map((s) => (
            <SuggestionCard key={s.id} s={s} documentId={documentId} editor={editor} ydoc={ydoc} canEdit={canEdit} />
          ))}
          {suggestions.data?.length === 0 && <p className="py-8 text-center text-sm text-muted">No suggestions.</p>}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
