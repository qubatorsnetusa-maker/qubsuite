import { AiAssistIcon } from '@/components/ai-assist-icon';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormDto, FormFieldDto, FormFieldType } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFieldTx, applyTx, fieldSetTx, formSetTx, moveFieldTx, QUESTION_TYPES, validateDefinition, type DefinitionIssue } from '@qub/shared/forms';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Bot, Eye, FastForward, FolderInput, Globe, GripVertical, Link2, PanelsTopLeft, Plus, Redo2, Rows, Settings2, Trash2, Type, Undo2, Variable } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
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
import { FormAiGenerator } from './form-ai-generator';
import { BuilderOpsProvider, useBuilderOps } from './builder/ops/builder-ops';
import { QuestionEditor } from './builder/question-editor';
import { ThemeButton } from './builder/theme-button';
import { TypePicker } from './builder/type-picker';
import { useDebouncedCommit } from './builder/use-debounced-commit';
import { VariablesPanel } from './builder/variables-panel';
import { FIELD_UI } from './registry';
import { RendererBoundary } from './renderer/renderer-boundary';
import { useFormRoom } from './use-form-room';
import { createCountryFieldOptions } from './countries';

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
            <Tooltip content="Switch to conversational mode">
              <Button asChild variant="subtle" size="icon" aria-label="Switch to conversational mode">
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
      <ShareDialog
        target={
          share
            ? {
                kind: 'file',
                id: form.fileId,
                name: form.title,
                isForm: true,
                customCopyUrl: publicUrl,
                copyButtonLabel: 'Copy form link',
              }
            : null
        }
        onOpenChange={setShare}
      />
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
  const [aiOpen, setAiOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = form.fields.findIndex((f) => f.id === e.over!.id);
    if (to < 0) return;
    ops.apply(moveFieldTx(form, String(e.active.id), Math.min(to, form.fields.length - 1)));
  };

  const addField = (type: FormFieldType, afterId?: string | null) => {
    const { tx, fieldId } = addFieldTx(form, type, afterId ?? active);
    ops.apply(tx);
    setActive(fieldId);
  };

  const addCountryField = (afterId?: string | null) => {
    const { tx, fieldId } = addFieldTx(form, 'DROPDOWN', afterId ?? active, 'Country');
    ops.apply(tx);
    const countryOpts = createCountryFieldOptions();
    const updateTx = fieldSetTx(ops.form, fieldId, {
      label: 'Country',
      settings: { ...ops.form.fields.find((f) => f.id === fieldId)?.settings, searchable: true },
      options: countryOpts,
    });
    if (updateTx) ops.apply(updateTx);
    setActive(fieldId);
    toast.success('Added Country question with ~195 countries prefilled');
  };

  const [aiBuilding, setAiBuilding] = useState<{
    total: number;
    current: number;
    currentLabel: string;
    stage: 'title' | 'description' | 'questions' | 'done';
  } | null>(null);

  const abortAiBuildingRef = useRef<(() => void) | null>(null);

  const handleApplyAiFields = (
    data: {
      title?: string;
      description?: string;
      fields: Array<{ label: string; type: FormFieldType; required: boolean; options?: string[] }>;
    },
    live = true
  ) => {
    let currentForm = ops.form;

    const applyAndTrack = (tx: ReturnType<typeof formSetTx>) => {
      if (!tx) return;
      ops.apply(tx);
      currentForm = applyTx(currentForm, tx);
    };

    if (!live) {
      if (data.title && !currentForm.title) applyAndTrack(formSetTx(currentForm, { title: data.title }));
      if (data.description && !currentForm.description) applyAndTrack(formSetTx(currentForm, { description: data.description }));
      let lastId: string | null = active;
      data.fields.forEach((field) => {
        const { tx, fieldId } = addFieldTx(currentForm, field.type, lastId, field.label);
        applyAndTrack(tx);
        if (field.required || field.options?.length) {
          const updateTx = fieldSetTx(currentForm, fieldId, {
            required: field.required,
            options: field.options?.map((opt, idx) => ({ id: crypto.randomUUID(), label: opt, kind: 'option', position: idx })),
          });
          applyAndTrack(updateTx);
        }
        lastId = fieldId;
      });
      if (lastId) setActive(lastId);
      toast.success(`Generated ${data.fields.length} questions with AI!`);
      return;
    }

    // Live visual building sequence
    let cancelled = false;
    let pendingFields = [...data.fields];
    let currentLastId = active;

    const skipToFinish = () => {
      cancelled = true;
      pendingFields.forEach((field) => {
        const { tx, fieldId } = addFieldTx(currentForm, field.type, currentLastId, field.label);
        applyAndTrack(tx);
        if (field.required || field.options?.length) {
          const updateTx = fieldSetTx(currentForm, fieldId, {
            required: field.required,
            options: field.options?.map((opt, idx) => ({ id: crypto.randomUUID(), label: opt, kind: 'option', position: idx })),
          });
          applyAndTrack(updateTx);
        }
        currentLastId = fieldId;
      });
      if (currentLastId) setActive(currentLastId);
      setAiBuilding({
        total: data.fields.length,
        current: data.fields.length,
        currentLabel: 'Completed',
        stage: 'done',
      });
      setTimeout(() => setAiBuilding(null), 1800);
      toast.success(`AI finished building all ${data.fields.length} questions.`);
    };

    abortAiBuildingRef.current = skipToFinish;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      if (data.title && !currentForm.title) {
        setAiBuilding({
          total: data.fields.length,
          current: 0,
          currentLabel: data.title,
          stage: 'title',
        });
        applyAndTrack(formSetTx(currentForm, { title: data.title }));
        await sleep(350);
        if (cancelled) return;
      }

      if (data.description && !currentForm.description) {
        setAiBuilding({
          total: data.fields.length,
          current: 0,
          currentLabel: data.description,
          stage: 'description',
        });
        applyAndTrack(formSetTx(currentForm, { description: data.description }));
        await sleep(300);
        if (cancelled) return;
      }

      for (let i = 0; i < data.fields.length; i++) {
        if (cancelled) return;
        const field = data.fields[i]!;
        pendingFields = data.fields.slice(i + 1);

        setAiBuilding({
          total: data.fields.length,
          current: i + 1,
          currentLabel: field.label,
          stage: 'questions',
        });

        const { tx, fieldId } = addFieldTx(currentForm, field.type, currentLastId, field.label);
        applyAndTrack(tx);
        currentLastId = fieldId;
        setActive(fieldId);

        if (field.required || field.options?.length) {
          const updateTx = fieldSetTx(currentForm, fieldId, {
            required: field.required,
            options: field.options?.map((opt, idx) => ({ id: crypto.randomUUID(), label: opt, kind: 'option', position: idx })),
          });
          applyAndTrack(updateTx);
        }

        setTimeout(() => {
          document.getElementById(`q-${fieldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        await sleep(450);
      }

      setAiBuilding({
        total: data.fields.length,
        current: data.fields.length,
        currentLabel: 'All questions generated',
        stage: 'done',
      });
      toast.success(`AI finished building all ${data.fields.length} questions.`);
      await sleep(2000);
      setAiBuilding(null);
    })();
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
    <div className="flex h-dvh min-h-dvh w-full flex-col relative" style={{ background: form.theme.backgroundColor }}>
      {aiBuilding && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 rounded-full border border-purple-200 bg-white px-5 py-2.5 text-slate-800 shadow-xl animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="relative flex size-7 items-center justify-center rounded-full bg-purple-50 border border-purple-100">
            <AiAssistIcon className="size-4 text-purple-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-purple-900">
              {aiBuilding.stage === 'title' && 'Designing form header...'}
              {aiBuilding.stage === 'description' && 'Writing form description...'}
              {aiBuilding.stage === 'questions' && `Building question ${aiBuilding.current} of ${aiBuilding.total}...`}
              {aiBuilding.stage === 'done' && 'Form created successfully'}
            </span>
            <span className="text-[11px] text-slate-500 max-w-xs truncate font-medium">
              {aiBuilding.currentLabel}
            </span>
          </div>
          {aiBuilding.stage === 'questions' && (
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-purple-100">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
                style={{ width: `${(aiBuilding.current / aiBuilding.total) * 100}%` }}
              />
            </div>
          )}
          {aiBuilding.stage !== 'done' && (
            <button
              type="button"
              onClick={() => abortAiBuildingRef.current?.()}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 transition hover:bg-purple-100"
            >
              <FastForward className="size-3" />
              <span>Skip</span>
            </button>
          )}
        </div>
      )}
      <FormTopBar form={form} tab="questions" status={ops.status} onRetry={ops.retry} onRename={(t) => ops.apply(formSetTx(form, { title: t }, 'Rename form'))} beforePublish={ops.flush} leading={undoRedo} readOnly={ops.readOnly} />
      <div className="flex min-h-0 flex-1">
        {/* sidebar / outline */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-2 md:block">
          <div className="px-2 py-1 text-xs font-semibold text-muted">Questions</div>
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
                <div key={f.id} className={cn('relative group transition-all duration-300', aiBuilding && active === f.id && 'ring-2 ring-purple-500 rounded-xl shadow-lg shadow-purple-500/10')}>
                  {aiBuilding && active === f.id && (
                    <div className="absolute -top-3 left-4 z-30 flex items-center gap-1.5 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-md animate-pulse">
                      <AiAssistIcon className="size-3" /> AI Assist Building...
                    </div>
                  )}
                  <QuestionEditor form={form} field={f} active={active === f.id} onActivate={() => setActive(f.id)} canEdit={canEdit} issues={issuesByField.get(f.id)} />
                  {active === f.id && canEdit && (
                    <aside
                      aria-label="Question actions"
                      className="absolute -right-14 top-2 hidden md:flex flex-col items-center gap-1 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-surface-1 z-20"
                    >
                      <TypePicker
                        onPick={(t) => addField(t, f.id)}
                        onPickSpecial={(s) => {
                          if (s === 'COUNTRY') addCountryField(f.id);
                        }}
                        trigger={
                          <button
                            type="button"
                            className="flex size-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                            title="Add question"
                            aria-label="Add question"
                          >
                            <Plus className="size-5" />
                          </button>
                        }
                      />
                      <button
                        type="button"
                        onClick={() => addCountryField(f.id)}
                        className="flex size-9 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                        title="Add Country question (with all countries)"
                        aria-label="Add Country question"
                      >
                        <Globe className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addField('STATEMENT', f.id)}
                        className="flex size-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                        title="Add title & description"
                        aria-label="Add title and description"
                      >
                        <Type className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addField('SECTION', f.id)}
                        className="flex size-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                        title="Add section"
                        aria-label="Add section"
                      >
                        <Rows className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiOpen(true)}
                        className="flex size-9 items-center justify-center rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition"
                        title="AI Assist"
                        aria-label="AI Assist"
                      >
                        <AiAssistIcon className="size-4" />
                      </button>
                    </aside>
                  )}
                </div>
              ))}
              {canEdit && (
                <div className="flex flex-wrap gap-2 pb-20">
                  <FormAiGenerator
                    canEdit={canEdit}
                    isOpen={aiOpen}
                    onOpenChange={setAiOpen}
                    onApplyGeneratedFields={handleApplyAiFields}
                  />
                  <TypePicker
                    onPick={addField}
                    onPickSpecial={(s) => {
                      if (s === 'COUNTRY') addCountryField();
                    }}
                    trigger={
                      <Button variant="outline" className="bg-background">
                        <Plus /> Add question
                      </Button>
                    }
                  />
                  <Button variant="outline" className="bg-background" onClick={() => addCountryField()}>
                    <Globe className="text-blue-500" /> Add Country
                  </Button>
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
  const [title, setTitle, flushTitle] = useDebouncedCommit(
    form.title ?? '',
    (v) => ops.apply(formSetTx(form, { title: v || 'Untitled form' }, 'Rename form'), { mergeKey: 'form-title' })
  );
  const [desc, setDesc, flushDesc] = useDebouncedCommit(
    form.description ?? '',
    (v) => ops.apply(formSetTx(form, { description: v || null }, 'Edit form description'), { mergeKey: 'form-description' })
  );

  return (
    <section className="overflow-hidden rounded-lg bg-background shadow-card">
      <div className="h-2.5" style={{ background: form.theme.primaryColor }} />
      <div className="p-6 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => {
            if (!title || /^untitleds+form$/i.test(title.trim())) {
              e.target.select();
            }
          }}
          onBlur={() => {
            flushTitle();
            ops.seal();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={!canEdit}
          placeholder="Untitled form"
          className="w-full text-3xl font-semibold bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-primary pb-1 px-0 outline-none focus:ring-0 transition-colors placeholder:text-muted"
          aria-label="Form title"
        />
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            flushDesc();
            ops.seal();
          }}
          disabled={!canEdit}
          placeholder="Form description"
          className="mt-2 min-h-10 border-0 border-b border-transparent hover:border-slate-300 focus:border-border px-0 focus:ring-0"
          aria-label="Form description"
        />
      </div>
    </section>
  );
}
