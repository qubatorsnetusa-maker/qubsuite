import type { FormDto, FormFieldDto, FormFieldType, UpdateFieldInput } from '@qub/shared';
import { duplicateFieldTx, fieldSetTx, QUESTION_TYPE_LIST, QUESTION_TYPES, type DefinitionIssue } from '@qub/shared/forms';
import { Copy, GitBranch, Image as ImageIcon, Link2, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Switch } from '@/components/ui/form-controls';
import { Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { canBranch } from './can-branch';
import { LogicPanel } from './logic-tab';
import { useBuilderOps } from './ops/builder-ops';
import { OptionsEditor } from './options-editor';
import { pipeSuggestions, PipingInput } from './piping-input';
import { DefaultAnswerSetting, PlaceholderSetting, ScorePanel, SETTINGS_PANELS } from './settings-panels';
import { useDebouncedCommit } from './use-debounced-commit';
import { useDeleteQuestion } from './use-delete-question';

import { createCountryFieldOptions } from '../countries';
export { ANSWER_COUNT_TIMEOUT_MS } from './use-delete-question';

export function QuestionEditor({
  form,
  field,
  active,
  onActivate,
  canEdit,
  issues,
}: {
  form: FormDto;
  field: FormFieldDto;
  active: boolean;
  onActivate(): void;
  canEdit: boolean;
  issues?: DefinitionIssue[];
}) {
  const ops = useBuilderOps();
  const update = (input: UpdateFieldInput, label?: string, mergeKey?: string) => ops.apply(fieldSetTx(form, field.id, input, label), mergeKey ? { mergeKey } : undefined);
  const [label, setLabel, flushLabel] = useDebouncedCommit(field.label, (v) => update({ label: v }, 'Edit question text', `label:${field.id}`));
  const [desc, setDesc, flushDesc] = useDebouncedCommit(field.description ?? '', (v) => update({ description: v || null }, 'Edit description', `description:${field.id}`));
  const def = QUESTION_TYPES[field.type];
  // Asks first when the question has collected answers (Undo won't bring them back).
  const { remove, checking, dialog: deleteDialog } = useDeleteQuestion(form);
  const duplicate = () => ops.apply(duplicateFieldTx(form, field.id)?.tx ?? null);
  const [logicOpen, setLogicOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState(field.settings.imageUrl?.startsWith('http') ? field.settings.imageUrl : '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isScreen = field.type === 'WELCOME' || field.type === 'ENDING';
  const isSection = field.type === 'SECTION';
  const hasLogic = field.rules.length > 0;
  const branchable = canBranch(field);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        update({ settings: { ...field.settings, imageUrl: compressedDataUrl, imageAlt: field.settings.imageAlt || file.name.replace(/\.[^.]+$/, '') } }, 'Attach question image');
        setImagePickerOpen(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    update({ settings: { ...field.settings, imageUrl: trimmed } }, 'Attach question image');
    setImagePickerOpen(false);
  };

  const handleRemoveQuestionImage = () => {
    update({ settings: { ...field.settings, imageUrl: null, imageAlt: undefined } }, 'Remove question image');
    setImageUrlInput('');
    setImagePickerOpen(false);
  };

  return (
    <section
      id={`q-${field.id}`}
      onClick={onActivate}
      className={cn('relative rounded-lg bg-background shadow-card transition-shadow', active && 'shadow-pop', isSection && 'mt-8')}
      aria-label={isSection ? `Section ${field.label}` : `Question ${field.label}`}
    >
      {active && <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-lg bg-[#4285f4]" aria-hidden />}
      {isSection && <div className="rounded-t-lg px-6 py-2 text-sm text-white" style={{ background: 'var(--color-form)' }}>Section</div>}
      {isScreen && <div className="rounded-t-lg bg-[#3c4043] px-6 py-2 text-sm text-white">{def.label}</div>}
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <PipingInput
            value={label}
            onChange={setLabel}
            onBlur={() => {
              flushLabel();
              ops.seal();
            }}
            disabled={!canEdit}
            placeholder={isSection ? 'Section title' : isScreen ? 'Screen title' : 'Question'}
            aria-label={isSection ? 'Section title' : isScreen ? 'Screen title' : 'Question text'}
            suggestions={pipeSuggestions(form, field.id)}
            className={cn('border-0 border-b bg-surface px-3 text-base', isSection && 'text-xl')}
          />
          {!isSection && !isScreen && field.type !== 'IMAGE_BLOCK' && field.type !== 'VIDEO_BLOCK' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                className="hidden"
              />
              <Tooltip content="Add image to question">
                <Button
                  type="button"
                  variant="subtle"
                  size="icon"
                  disabled={!canEdit}
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePickerOpen((v) => !v);
                  }}
                  aria-label="Add image to question"
                  className={cn('h-10 w-10 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900', (field.settings.imageUrl || imagePickerOpen) && 'bg-blue-50 text-blue-600')}
                >
                  <ImageIcon className="size-5" />
                </Button>
              </Tooltip>
            </>
          )}
          {!isSection && !isScreen && (
            <NativeSelect
              aria-label="Question type"
              value={field.type}
              disabled={!canEdit}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'COUNTRY') {
                  update({
                    type: 'DROPDOWN',
                    label: field.label && field.label !== 'Question' ? field.label : 'Country',
                    settings: { ...field.settings, searchable: true },
                    options: createCountryFieldOptions(),
                  }, 'Set question to Country');
                } else {
                  update({ type: val as FormFieldType }, 'Change question type');
                }
              }}
              className="h-10 w-48"
            >
              <option value="COUNTRY">Country (All countries)</option>
              {QUESTION_TYPE_LIST.filter((d) => !['SECTION', 'WELCOME', 'ENDING'].includes(d.type)).map((d) => (
                <option key={d.type} value={d.type}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        {(active || desc) && (
          <PipingInput
            value={desc}
            onChange={setDesc}
            onBlur={() => {
              flushDesc();
              ops.seal();
            }}
            disabled={!canEdit}
            placeholder="Description (optional)"
            aria-label="Description"
            multiline
            suggestions={pipeSuggestions(form, field.id)}
            className="min-h-10 text-sm"
          />
        )}

        {imagePickerOpen && !isSection && !isScreen && field.type !== 'IMAGE_BLOCK' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="size-4 text-blue-600" />
                Attach guiding image to question
              </span>
              <button
                type="button"
                onClick={() => setImagePickerOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                aria-label="Close image picker"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white gap-1.5 text-xs"
              >
                <Upload className="size-3.5" />
                Upload from device
              </Button>
              <span className="text-xs text-slate-400">or</span>
              <div className="flex flex-1 min-w-[200px] items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Paste image URL (https://...)"
                    className="h-8 pl-8 text-xs bg-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyImageUrl();
                      }
                    }}
                  />
                </div>
                <Button type="button" size="sm" onClick={handleApplyImageUrl} disabled={!imageUrlInput.trim()} className="h-8 text-xs">
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isSection && !isScreen && field.type !== 'IMAGE_BLOCK' && field.settings.imageUrl && (
          <div className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="relative inline-block max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
              <img
                src={field.settings.imageUrl}
                alt={field.settings.imageAlt ?? field.label}
                className="max-h-64 w-auto max-w-full object-contain rounded-lg"
              />
              {canEdit && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm border border-slate-200 hover:bg-white"
                    title="Change image"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveQuestionImage}
                    className="rounded-md bg-white/95 p-1 text-rose-600 shadow-sm border border-slate-200 hover:bg-rose-50"
                    title="Remove image"
                    aria-label="Remove question image"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            {canEdit && active && (
              <Input
                type="text"
                value={field.settings.imageAlt ?? ''}
                onChange={(e) => update({ settings: { ...field.settings, imageAlt: e.target.value || undefined } }, 'Update image caption', `imageAlt:${field.id}`)}
                placeholder="Image caption / alt text (optional)"
                className="h-8 text-xs bg-white"
              />
            )}
          </div>
        )}

        {def.optionKinds.length > 0 && <OptionsEditor field={field} canEdit={canEdit} onUpdate={(i) => update(i)} />}
        {(() => {
          const Panel = SETTINGS_PANELS[field.type];
          return Panel ? <Panel field={field} canEdit={canEdit} onUpdate={(i) => update(i)} /> : null;
        })()}
        {active && <PlaceholderSetting field={field} canEdit={canEdit} onUpdate={(i) => update(i)} />}
        {active && <DefaultAnswerSetting field={field} canEdit={canEdit} onUpdate={(i) => update(i, 'Change default answer')} color={form.theme.primaryColor} />}
        {active && def.isInput && <ScorePanel field={field} canEdit={canEdit} onUpdate={(i) => update(i)} quiz={form.settings.quiz.enabled} />}
        {active && !isSection && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Advanced</summary>
            <label className="mt-2 flex items-center gap-2 text-muted">
              Key for {'{{…}}'} and formulas
              <Input className="h-8 w-48 font-mono" disabled={!canEdit} defaultValue={field.ref} key={field.ref} aria-label="Question key" onBlur={(e) => e.target.value !== field.ref && update({ ref: e.target.value }, 'Change key')} />
            </label>
          </details>
        )}
        {issues && issues.some((i) => i.severity === 'error') && (
          <ul role="alert" className="space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {issues.filter((i) => i.severity === 'error').map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        )}
        {issues && issues.some((i) => i.severity === 'warning') && (
          <ul className="space-y-1 rounded-md bg-[#fef7e0] px-3 py-2 text-sm text-warning">
            {issues.filter((i) => i.severity === 'warning').map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        )}

        {hasLogic && (
          <p className="flex items-center gap-2 text-xs text-form">
            <GitBranch className="size-4" /> {field.rules.length} logic rule{field.rules.length > 1 ? 's' : ''}
          </p>
        )}

        {canEdit && active && (
          <footer className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
            {branchable && (
              <Button variant="subtle" size="sm" onClick={() => setLogicOpen(true)}>
                <GitBranch /> Logic
              </Button>
            )}
            {field.type !== 'WELCOME' && (
              <Tooltip content="Duplicate">
                <Button variant="subtle" size="icon-sm" onClick={duplicate} aria-label="Duplicate">
                  <Copy />
                </Button>
              </Tooltip>
            )}
            <Tooltip content="Delete">
              <Button variant="subtle" size="icon-sm" onClick={() => void remove(field.id)} disabled={checking} aria-label="Delete">
                <Trash2 />
              </Button>
            </Tooltip>
            {def.isInput && field.type !== 'HIDDEN' && (
              <>
                <span className="mx-2 h-6 w-px bg-border" />
                <label className="flex items-center gap-2 text-sm">
                  Required <Switch checked={field.required} onCheckedChange={(v) => update({ required: v }, v ? 'Make required' : 'Make optional')} />
                </label>
              </>
            )}
          </footer>
        )}
      </div>
      {logicOpen && <LogicPanel form={form} field={field} onClose={() => setLogicOpen(false)} />}
      {deleteDialog}
    </section>
  );
}
