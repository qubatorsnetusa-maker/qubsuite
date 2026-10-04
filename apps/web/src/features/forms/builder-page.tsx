import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormDto, FormFieldDto, FormFieldType } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFieldTx, formSetTx, moveFieldTx, QUESTION_TYPES, validateDefinition, type DefinitionIssue } from '@qub/shared/forms';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Eye, FolderInput, GripVertical, Link2, PanelsTopLeft, Plus, Redo2, Settings2, Trash2, Undo2, Variable } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EditorHeader, SaveIndicator, type SaveStatus } from '@/components/editor-header';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { ApiError, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Badge, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/use-auth';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { MoveDialog } from '../drive/dialogs';
import { ShareDialog } from '../sharing/share-dialog';
import { FormIssues } from './builder/form-issues';
import { FormSettingsDialog } from './builder/form-settings-dialog';
import { BuilderOpsProvider, useBuilderOps } from './builder/ops/builder-ops';
import { QuestionEditor } from './builder/question-editor';
import { ThemeButton } from './builder/theme-button';
import { TypePicker } from './builder/type-picker';
import { useDebouncedCommit } from './builder/use-debounced-commit';
import { VariablesPanel } from './builder/variables-panel';
import { FIELD_UI } from './registry';
import { RendererBoundary } from './renderer/renderer-boundary';
import { useFormRoom } from './use-form-room';

export function BuilderPage() {
  const { formId } = useParams({ from: '/_authenticated/forms/$formId/edit' });
  const me = useCurrentUser();
  const form = useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) });
  if (form.isLoading) return <FullPageSpinner label="Opening form…" />;
  if (form.error) return <ErrorState error={form.error} onRetry={() => void form.refetch()} title="Can’t open this form" />;
  return (
    <BuilderOpsProvider formId={formId} userId={me.id}>
      <Builder />
    </BuilderOpsProvider>
  );
}

/** Shared header for the builder and responses views. */
export function FormTopBar({
  form,
  tab,
  status = 'saved',
  onRetry,
  onRename,
  beforePublish,
  leading,
  readOnly = false,
}: {
  form: FormDto;
  tab: 'questions' | 'responses';
  status?: SaveStatus;
  onRetry?(): void;
  onRename?(title: string): unknown;
  beforePublish?(): Promise<void>;
  leading?: ReactNode;
  /** Editing was revoked while the builder is open: no renaming, publishing or trashing. */
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const presence = useFormRoom(form.id);
  const [share, setShare] = useState(false);
  const [move, setMove] = useState(false);
  const canEdit = form.capabilities.canEdit && !form.isTrashed && !readOnly;
  const setForm = (f: FormDto) => qc.setQueryData(qk.forms.one(form.id), f);
  const rename = useMutation({ mutationFn: (title: string) => formsService.update(form.id, { title }), onSuccess: setForm });
  const publish = useMutation({
    mutationFn: async (p: boolean) => {
      await beforePublish?.();
      return formsService.publish(form.id, p);
    },
    onSuccess: (f) => {
      setForm(f);
      toast.success(f.isPublished ? 'Form published — share the link to collect responses' : 'Form unpublished');
    },
    onError: (e) => {
      const issues = e instanceof ApiError ? (e.details as { issues?: unknown[] } | undefined)?.issues : undefined;
      toast.error(issues?.length ? `Fix ${issues.length} problem(s) highlighted in the form before publishing` : errorMessage(e));
    },
  });
  const trash = useMutation({ mutationFn: () => formsService.trash(form.id), onSuccess: () => void navigate({ to: '/drive' }) });
  const publicUrl = `${window.location.origin}/forms/${form.publicId}/fill`;
  return (
    <div className="border-b border-border bg-background">
      <EditorHeader
        fileType="FORM"
        title={form.title}
        onRename={(t) => {
          if (!onRename) return rename.mutateAsync(t);
          onRename(t);
        }}
        canEdit={canEdit}
        status={<SaveIndicator status={status} onRetry={onRetry} />}
        presence={presence.map((u) => ({ key: u.clientId, name: u.name, avatarUrl: u.avatarUrl, color: u.color }))}
        readOnlyLabel={canEdit ? undefined : 'View only'}
        onShare={() => setShare(true)}
        actions={
          <>
            {leading}
            <Tooltip content="Preview">
              <Button asChild variant="subtle" size="icon" aria-label="Preview">
                <Link to="/forms/$formId/preview" params={{ formId: form.id }}>
                  <Eye />
                </Link>
              </Button>
            </Tooltip>
            <Tooltip content="Open in Forms v2">
              <Button asChild variant="subtle" size="icon" aria-label="Open in Forms v2">
                <Link to="/formsv2/$formId/content" params={{ formId: form.id }}>
                  <PanelsTopLeft />
                </Link>
              </Button>
            </Tooltip>
            {form.isPublished && (
              <Tooltip content="Copy respondent link">
                <Button variant="subtle" size="icon" aria-label="Copy respondent link" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success('Link copied'))}>
                  <Link2 />
                </Button>
              </Tooltip>
            )}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="subtle" size="icon" aria-label="More">
                    <Settings2 />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem icon={<FolderInput />} onSelect={() => setMove(true)}>
                    Move
                  </DropdownMenuItem>
                  {form.capabilities.canTrash && (
                    <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => trash.mutate()}>
                      Move to trash
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canEdit && (
              <Button onClick={() => publish.mutate(!form.isPublished)} loading={publish.isPending} variant={form.isPublished ? 'outline' : 'primary'}>
                {form.isPublished ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          </>
        }
      />
      <nav className="flex justify-center gap-2" aria-label="Form views">
        <Link to="/forms/$formId/edit" params={{ formId: form.id }} className={cn('border-b-[3px] px-4 py-2 text-sm font-medium', tab === 'questions' ? 'border-form text-form' : 'border-transparent text-muted')}>
          Questions
        </Link>
        {form.capabilities.canEdit && (
          <Link to="/forms/$formId/responses" params={{ formId: form.id }} className={cn('flex items-center gap-1.5 border-b-[3px] px-4 py-2 text-sm font-medium', tab === 'responses' ? 'border-form text-form' : 'border-transparent text-muted')}>
            Responses <Badge tone="primary">{form.responseCount}</Badge>
          </Link>
        )}
      </nav>
      <ShareDialog target={share ? { kind: 'file', id: form.fileId, name: form.title } : null} onOpenChange={setShare} />
      <MoveDialog items={move ? [{ kind: 'file', id: form.fileId, name: form.title }] : null} onOpenChange={setMove} />
    </div>
  );
}

function Builder() {
  const ops = useBuilderOps();
  const form = ops.form;
  const canEdit = form.capabilities.canEdit && !form.isTrashed && !ops.readOnly;
  const [active, setActive] = useState<string | null>(form.fields[0]?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    // The drop target's index, kept inside the list (moveFieldTx expects an index it can splice at).
    const to = form.fields.findIndex((f) => f.id === e.over!.id);
    if (to < 0) return;
    ops.apply(moveFieldTx(form, String(e.active.id), Math.min(to, form.fields.length - 1)));
  };

  const addField = (type: FormFieldType) => {
    const { tx, fieldId } = addFieldTx(form, type, active);
    ops.apply(tx);
    setActive(fieldId);
  };

  const undoRedo = canEdit && (
    <>
      <Tooltip content={ops.undoLabel ? `Undo ${ops.undoLabel}` : 'Undo'}>
        <Button variant="subtle" size="icon" aria-label="Undo" disabled={!ops.canUndo} onClick={ops.undo}>
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content={ops.redoLabel ? `Redo ${ops.redoLabel}` : 'Redo'}>
        <Button variant="subtle" size="icon" aria-label="Redo" disabled={!ops.canRedo} onClick={ops.redo}>
          <Redo2 />
        </Button>
      </Tooltip>
    </>
  );

  const hasWelcome = form.fields.some((f) => f.type === 'WELCOME');

  const issues = useMemo(
    () => validateDefinition({ fields: form.fields, variables: form.variables }, { quiz: form.settings.quiz.enabled, confirmationMessage: form.settings.confirmationMessage }),
    [form.fields, form.variables, form.settings.quiz.enabled, form.settings.confirmationMessage],
  );
  const issuesByField = useMemo(() => {
    const m = new Map<string, DefinitionIssue[]>();
    for (const i of issues) if (i.fieldId) m.set(i.fieldId, [...(m.get(i.fieldId) ?? []), i]);
    return m;
  }, [issues]);

  return (
    <div className="flex h-full flex-col" style={{ background: form.theme.backgroundColor }}>
      <FormTopBar form={form} tab="questions" status={ops.status} onRetry={ops.retry} onRename={(t) => ops.apply(formSetTx(form, { title: t }, 'Rename form'))} beforePublish={ops.flush} leading={undoRedo} readOnly={ops.readOnly} />
      <div className="flex min-h-0 flex-1">
        {/* outline */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-background/80 p-3 lg:block" aria-label="Questions">
          <h2 className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted">Questions</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-1">
                {form.fields.map((f, i) => (
                  <OutlineItem
                    key={f.id}
                    field={f}
                    index={form.fields.slice(0, i).filter((x) => QUESTION_TYPES[x.type].isStep).length}
                    active={active === f.id}
                    hasIssues={issuesByField.has(f.id)}
                    onSelect={() => {
                      setActive(f.id);
                      document.getElementById(`q-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    draggable={canEdit && f.type !== 'WELCOME' && f.type !== 'ENDING'}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </aside>
        {/* canvas */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
          <RendererBoundary>
            <div className="mx-auto max-w-[768px] space-y-3">
              {form.isTrashed && <p className="rounded-lg bg-[#fef7e0] px-4 py-2 text-sm">This form is in the trash.</p>}
              {form.isPublished ? (
                <p className="flex items-center justify-between rounded-lg bg-background px-4 py-2 text-sm shadow-card">
                  <span>
                    Published · {form.acceptingResponses ? 'accepting responses' : 'not accepting responses'}
                  </span>
                  <a className="text-primary hover:underline" href={`/forms/${form.publicId}/fill`} target="_blank" rel="noreferrer">
                    Open live form
                  </a>
                </p>
              ) : (
                <p className="rounded-lg bg-background px-4 py-2 text-sm text-muted shadow-card">Draft — publish to start collecting responses.</p>
              )}
              <FormHeaderCard form={form} canEdit={canEdit} />
              <FormIssues issues={issues} />
              {form.fields.map((f) => (
                <QuestionEditor key={f.id} form={form} field={f} active={active === f.id} onActivate={() => setActive(f.id)} canEdit={canEdit} issues={issuesByField.get(f.id)} />
              ))}
              {canEdit && (
                <div className="flex flex-wrap gap-2 pb-20">
                  <TypePicker
                    onPick={addField}
                    trigger={
                      <Button variant="outline" className="bg-background">
                        <Plus /> Add question
                      </Button>
                    }
                  />
                  <Button variant="outline" className="bg-background" onClick={() => addField('SECTION')}>
                    <Plus /> Add section
                  </Button>
                  {!hasWelcome && (
                    <Button variant="outline" className="bg-background" onClick={() => addField('WELCOME')}>
                      <Plus /> Add welcome screen
                    </Button>
                  )}
                  <Button variant="outline" className="bg-background" onClick={() => addField('ENDING')}>
                    <Plus /> Add ending
                  </Button>
                  <ThemeButton form={form} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="bg-background">
                        <Variable /> Variables{form.variables.length ? ` (${form.variables.length})` : ''}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[28rem]">
                      <VariablesPanel form={form} issues={issues} />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" className="bg-background" onClick={() => setSettingsOpen(true)}>
                    <Settings2 /> Settings
                  </Button>
                </div>
              )}
            </div>
          </RendererBoundary>
        </main>
      </div>
      <FormSettingsDialog form={form} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function OutlineItem({ field, index, active, hasIssues, onSelect, draggable }: { field: FormFieldDto; index: number; active: boolean; hasIssues: boolean; onSelect(): void; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, disabled: !draggable });
  const isStep = QUESTION_TYPES[field.type].isStep;
  const Icon = FIELD_UI[field.type].icon;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex items-center gap-1 rounded-md text-sm', active ? 'bg-[#ede7f6]' : 'hover:bg-hover', isDragging && 'opacity-60 shadow-pop')}>
      {draggable && (
        <button {...attributes} {...listeners} className="cursor-grab p-1 text-subtle" aria-label={`Reorder ${field.label || 'question'}`}>
          <GripVertical className="size-4" />
        </button>
      )}
      <button onClick={onSelect} className={cn('flex min-w-0 flex-1 items-center gap-2 truncate py-1.5 pr-2 text-left', field.type === 'SECTION' && 'font-semibold')}>
        <Icon className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="truncate">
          {field.type === 'SECTION' ? '§ ' : isStep ? `${index + 1}. ` : ''}
          {field.label || 'Untitled'}
        </span>
        {hasIssues && <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-label="Has problems" />}
      </button>
    </li>
  );
}

function FormHeaderCard({ form, canEdit }: { form: FormDto; canEdit: boolean }) {
  const ops = useBuilderOps();
  const [desc, setDesc, flush] = useDebouncedCommit(form.description ?? '', (v) => ops.apply(formSetTx(form, { description: v || null }, 'Edit form description'), { mergeKey: 'form-description' }));
  return (
    <section className="overflow-hidden rounded-lg bg-background shadow-card">
      <div className="h-2.5" style={{ background: form.theme.primaryColor }} />
      <div className="p-6">
        <h1 className="text-3xl">{form.title}</h1>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            flush();
            ops.seal();
          }}
          disabled={!canEdit}
          placeholder="Form description"
          className="mt-3 min-h-10 border-0 border-b px-0 focus:ring-0"
          aria-label="Form description"
        />
      </div>
    </section>
  );
}
