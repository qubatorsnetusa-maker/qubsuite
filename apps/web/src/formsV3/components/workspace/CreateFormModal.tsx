import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  FileText,
  UserCheck,
  Calendar,
  Bug,
  Heart,
  Briefcase,
} from 'lucide-react';
import type { FormConfig, FormStep } from '../../types';
import { FORM_THEMES } from '../../data/defaultForms';
import { FORM_TEMPLATE_PRESETS } from '../../data/formTemplates';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface CreateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: string[];
  activeFolder?: string;
  onCreateForm: (newForm: FormConfig) => Promise<void>;
  notifyOnSubmission: boolean;
  userEmail: string;
}

interface TemplatePreset {
  id: string;
  title: string;
  description: string;
  badge: string;
  defaultFolder?: string;
  icon: React.ReactNode;
  themeId: string;
  starterSteps: FormStep[];
  thankYouTitle?: string;
  thankYouMessage?: string;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'blank',
    title: 'Start from Blank Canvas',
    description: 'A clean slate with a single welcoming intro and your first question ready to build.',
    badge: 'Blank',
    icon: <FileText className="w-4 h-4 text-slate-600" />,
    themeId: 'default',
    starterSteps: [
      {
        id: 'step-welcome-init',
        type: 'welcome',
        title: 'Welcome to our form.',
        description: 'Please answer the following few questions.',
        buttonLabel: 'Get Started',
      },
      {
        id: 'step-first-q',
        type: 'short_text',
        title: 'What is your primary goal today?',
        placeholder: 'e.g. Scaling customer feedback',
        validation: { required: true },
      },
    ],
  },
  ...FORM_TEMPLATE_PRESETS.map((p) => {
    let icon = <Sparkles className="w-4 h-4 text-amber-600" />;
    if (p.iconName === 'user-check') icon = <UserCheck className="w-4 h-4 text-blue-600" />;
    else if (p.iconName === 'calendar') icon = <Calendar className="w-4 h-4 text-rose-600" />;
    else if (p.iconName === 'bug') icon = <Bug className="w-4 h-4 text-sky-600" />;
    else if (p.iconName === 'heart') icon = <Heart className="w-4 h-4 text-emerald-600" />;
    else if (p.iconName === 'briefcase') icon = <Briefcase className="w-4 h-4 text-purple-600" />;
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      badge: p.badge,
      defaultFolder: p.folder,
      icon,
      themeId: p.themeId,
      starterSteps: p.starterSteps,
      thankYouTitle: p.thankYouTitle,
      thankYouMessage: p.thankYouMessage,
    };
  }),
];

export const CreateFormModal: React.FC<CreateFormModalProps> = ({
  isOpen,
  onClose,
  folders,
  activeFolder,
  onCreateForm,
  notifyOnSubmission,
  userEmail,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState(
    activeFolder && activeFolder !== 'all' && activeFolder !== 'favorites'
      ? activeFolder
      : folders[0] || ''
  );
  const [themeId, setThemeId] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSelectPreset = (preset: TemplatePreset) => {
    setSelectedTemplateId(preset.id);
    if (!title || TEMPLATE_PRESETS.some((p) => p.title === title || title === 'Untitled Conversational Form')) {
      setTitle(preset.id === 'blank' ? 'Untitled Conversational Form' : preset.title);
    }
    setDescription(preset.description);
    setThemeId(preset.themeId);
    if (preset.defaultFolder && folders.includes(preset.defaultFolder)) {
      setFolder(preset.defaultFolder);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const finalTitle = title.trim() || 'Untitled Conversational Form';
    const chosenTemplate =
      TEMPLATE_PRESETS.find((t) => t.id === selectedTemplateId) || TEMPLATE_PRESETS[0]!;

    const newFormId = `form-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;

    const newForm: FormConfig = {
      id: newFormId,
      title: finalTitle,
      description: description.trim() || chosenTemplate.description,
      themeId: themeId,
      showProgressBar: true,
      showQuestionNumbers: true,
      allowKeyboardShortcuts: true,
      folder: folder || undefined,
      status: 'published',
      isFavorite: false,
      createdAt: 'Today',
      updatedAt: 'Just now',
      steps: chosenTemplate.starterSteps.map((s, idx) => ({
        ...s,
        id: `${newFormId}-step-${idx + 1}`,
      })),
      thankYou: {
        title: chosenTemplate.thankYouTitle || 'Thank you for your response!',
        message: chosenTemplate.thankYouMessage || 'Your answers have been recorded.',
        buttonLabel: 'Submit Another Response',
        showRestartButton: true,
        badgeIcon: 'check',
      },
      // Seeded from the account's "notify me on new submissions" default
      // (Settings page); editable per-form afterwards in NotificationSettingsEditor.
      notifications: {
        enabled: notifyOnSubmission,
        recipientEmail: userEmail,
      },
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onCreateForm(newForm);
      onClose();
    } catch {
      setSubmitError('Could not create the form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="create-form-title" maxWidth="2xl">
      {/* Modal Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 id="create-form-title" className="font-headline-sm text-base font-bold text-slate-900 tracking-tight">
              Create New Form
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Choose a starter preset or begin from a clean canvas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal Body */}
      <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
        {/* Starter Presets Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code mb-2.5">
            Select Starter Preset
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATE_PRESETS.map((preset) => {
              const isChosen = selectedTemplateId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    isChosen
                      ? 'border-2 border-indigo-600 bg-indigo-50 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                      : 'border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                          {preset.icon}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{preset.title}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono-code">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-mono-code text-slate-400">
                    <span>{preset.starterSteps.length} starter step{preset.starterSteps.length === 1 ? '' : 's'}</span>
                    {isChosen && <span className="font-bold text-indigo-700">Selected ✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Title & Folder Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-create-form-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Form Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-create-form-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Feedback Survey"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="select-create-form-folder" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Folder / Category
            </label>
            <select
              id="select-create-form-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white cursor-pointer"
            >
              <option value="">No Folder (Unassigned)</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="input-create-form-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Short Description (Optional)
          </label>
          <input
            id="input-create-form-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 4 questions about your recent user experience"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
          />
        </div>

        {/* Initial Theme Picker */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono-code mb-2.5">
            Initial Color Theme
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {FORM_THEMES.map((theme) => {
              const isSelectedTheme = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    isSelectedTheme
                      ? 'border-2 border-indigo-600 bg-indigo-50 font-semibold shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                      : 'border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 shadow-2xs shrink-0"
                    style={{ backgroundColor: theme.primaryColorHex }}
                  />
                  <span className="text-xs text-slate-800 truncate font-medium">
                    {theme.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-slate-100">
          {submitError && (
            <p role="alert" className="mr-auto text-xs font-medium text-rose-600">
              {submitError}
            </p>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Form'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
