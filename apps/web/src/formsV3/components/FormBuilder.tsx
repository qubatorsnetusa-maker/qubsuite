import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Settings,
  Eye,
  Type,
  Mail,
  Phone,
  ListOrdered,
  Star,
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Palette,
  Share2,
  FileDown,
  Check,
  AlignLeft,
  HandMetal,
  Smartphone,
  Monitor,
  Link2,
  Globe,
  ExternalLink,
  GitBranch,
  Clock,
  AlertCircle,
  RotateCcw,
  Cloud,
  Hash,
  Calendar,
  ToggleLeft,
  Upload,
  Building,
  LayoutTemplate,
  ChevronRight,
  Split,
  ShieldAlert,
  Wifi,
  WifiOff,
  History,
  Database,
  HardDrive,
  X,
} from 'lucide-react';
import type { FormConfig, FormStep, QuestionType, PreviewDevice, ThankYouConfig } from '../types';
import { FORM_THEMES } from '../data/defaultForms';
import { DevicePreviewFrame } from './DevicePreviewFrame';
import { FormRespondent } from './FormRespondent';
import { ShareFormModal } from './ShareFormModal';
import { LogicBranchingEditor } from './LogicBranchingEditor';
import { LogicFlowView } from './LogicFlowView';
import { StepValidationEditor } from './StepValidationEditor';
import { WelcomeScreenEditor } from './WelcomeScreenEditor';
import { ThankYouEditor } from './ThankYouEditor';
import { NotificationSettingsEditor } from './NotificationSettingsEditor';
import { ThemeDesignEditor } from './ThemeDesignEditor';
import { BrandingHeaderFooterEditor } from './BrandingHeaderFooterEditor';
import { AddQuestionTypeDialog } from './AddQuestionTypeDialog';
import { BuilderFAB } from './BuilderFAB';
import { OfflineDraftManagerModal } from './OfflineDraftManagerModal';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  saveDraftToStorage,
  getDraftFromStorage,
  clearDraftFromStorage,
  formatRelativeDraftTime,
} from '../utils/draftUtils';
import type { FormDraft } from '../utils/draftUtils';
import { useSharableFormUrl, copyToClipboard } from '../utils/shareUtils';
import type { SaveStatus } from '../pages/FormBuilder';

interface FormBuilderProps {
  form: FormConfig;
  onSaveForm: (updated: FormConfig) => void;
  onForceSave: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  onLaunchFullscreenDemo: () => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  form,
  onSaveForm,
  onForceSave,
  saveStatus,
  lastSavedAt,
  onLaunchFullscreenDemo,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string>(
    form.steps[0]?.id || ''
  );
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [isCopied, setIsCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'content' | 'welcome' | 'validation' | 'logic' | 'thank_you' | 'theme' | 'branding'
  >('content');

  // Mobile layout view toggle ('outline' | 'editor' | 'preview' | 'logic_flow')
  const [mobileView, setMobileView] = useState<'outline' | 'editor' | 'preview' | 'logic_flow'>('editor');

  // Canvas Mode: interactive device preview vs visual logic flow tree
  const [canvasMode, setCanvasMode] = useState<'preview' | 'logic_flow'>('preview');

  // Count active conditional branching rules across form
  const logicRuleCount = useMemo(() => {
    return form.steps.reduce((acc, step) => {
      if (step.logic?.enabled) {
        return acc + (step.logic.rules?.length || 0);
      }
      return acc;
    }, 0);
  }, [form.steps]);

  // Check if form has any conditional logic configured
  const hasConditionalLogic = useMemo(() => {
    return form.steps.some((s) => s.logic?.enabled && (s.logic.rules?.length || 0) > 0);
  }, [form.steps]);

  // Drag-and-drop reordering state for outline steps list
  const [draggedStepIdx, setDraggedStepIdx] = useState<number | null>(null);
  const [dragOverStepIdx, setDragOverStepIdx] = useState<number | null>(null);
  const [dropIndicatorPos, setDropIndicatorPos] = useState<'above' | 'below' | null>(null);

  // Local browser-storage draft: a crash-recovery cache, independent of the
  // real save (`saveStatus`, driven by the actual server round trip below).
  const { isOnline } = useNetworkStatus();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<{
    draft: FormDraft;
    promptVisible: boolean;
  } | null>(null);

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialMountRef = useRef(true);

  const sharableUrl = useSharableFormUrl(form.id);

  const selectedStepIndex = form.steps.findIndex((s) => s.id === selectedStepId);
  const currentStep = form.steps[selectedStepIndex] || form.steps[0];

  const handleSaveAndLaunchDemo = () => {
    onForceSave();
    onLaunchFullscreenDemo();
  };

  // Check for existing auto-saved draft on mount or form change
  useEffect(() => {
    const existing = getDraftFromStorage(form.id);
    if (existing && existing.timestamp) {
      const isDiff =
        existing.form.steps.length !== form.steps.length ||
        existing.form.title !== form.title ||
        JSON.stringify(existing.form.steps) !== JSON.stringify(form.steps);
      if (isDiff) {
        setRecoveredDraft({ draft: existing, promptVisible: true });
      }
    }
  }, [form.id]);

  // Debounced local draft checkpoint whenever the form changes — a
  // crash-recovery cache in localStorage, separate from the real save.
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      saveDraftToStorage(form, !isOnline, 'auto_save');
      setLastAutoSavedTime(formatRelativeDraftTime(Date.now()));
    }, 900);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [form, isOnline]);

  // Keyboard shortcut Ctrl/Cmd + S to flush the pending real save immediately.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onForceSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onForceSave]);

  const handleRestoreDraft = () => {
    if (!recoveredDraft) return;
    onSaveForm(recoveredDraft.draft.form);
    setRecoveredDraft(null);
    setLastAutoSavedTime(formatRelativeDraftTime(recoveredDraft.draft.timestamp));
  };

  const handleDiscardDraft = () => {
    clearDraftFromStorage(form.id);
    setRecoveredDraft(null);
    setLastAutoSavedTime(null);
  };

  // Updates a field of the currently selected step
  const handleUpdateStep = (updatedFields: Partial<FormStep>) => {
    if (!currentStep) return;
    const newSteps = form.steps.map((step) =>
      step.id === currentStep.id ? { ...step, ...updatedFields } : step
    );
    onSaveForm({ ...form, steps: newSteps, updatedAt: 'Just now' });
  };

  // Add new step
  const handleAddStep = (type: QuestionType) => {
    const newId = 'step-' + Date.now();
    let newStep: FormStep = {
      id: newId,
      type,
      title: 'New question prompt',
      validation: { required: false },
    };

    switch (type) {
      case 'welcome':
        newStep = {
          ...newStep,
          title: 'Welcome to this form',
          description: 'Takes about 2 minutes to complete.',
          buttonLabel: 'Get Started',
          timeEstimate: 'Takes ~2 mins',
          tagline: 'Welcome',
        };
        break;
      case 'short_text':
        newStep = {
          ...newStep,
          title: 'What is your answer?',
          placeholder: 'Type here...',
          validation: { required: true, minLength: 2 },
        };
        break;
      case 'email':
        newStep = {
          ...newStep,
          title: 'What is your email address?',
          placeholder: 'name@domain.com',
          validation: {
            required: true,
            pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
            customErrorMessage: 'Please enter a valid email format.',
          },
        };
        break;
      case 'phone':
        newStep = {
          ...newStep,
          title: 'What is your phone number?',
          placeholder: '+1 (555) 000-0000',
          validation: { required: false },
        };
        break;
      case 'long_text':
        newStep = {
          ...newStep,
          title: 'Please describe in detail',
          placeholder: 'Share your thoughts...',
        };
        break;
      case 'multiple_choice':
        newStep = {
          ...newStep,
          title: 'Select one option below',
          options: [
            { id: 'opt-' + Date.now() + '-1', label: 'Option 1', keyHint: 'A' },
            { id: 'opt-' + Date.now() + '-2', label: 'Option 2', keyHint: 'B' },
            { id: 'opt-' + Date.now() + '-3', label: 'Option 3', keyHint: 'C' },
          ],
          validation: { required: true },
        };
        break;
      case 'rating':
        newStep = {
          ...newStep,
          title: 'How would you rate this experience?',
          ratingMax: 5,
          validation: { required: true },
        };
        break;
      case 'opinion_scale':
        newStep = {
          ...newStep,
          title: 'How likely are you to recommend us?',
          scaleMax: 10,
          scaleMinLabel: 'Not likely',
          scaleMaxLabel: 'Extremely likely',
          validation: { required: true },
        };
        break;
      case 'number':
        newStep = {
          ...newStep,
          title: 'Enter a numeric amount',
          placeholder: '0',
          numberPrefix: '$',
          numberMin: 0,
          numberMax: 100000,
          numberStep: 1,
          validation: { required: true },
        };
        break;
      case 'date':
        newStep = {
          ...newStep,
          title: 'When did this take place?',
          validation: { required: true },
        };
        break;
      case 'yes_no':
        newStep = {
          ...newStep,
          title: 'Do you agree with these terms?',
          yesLabel: 'Yes',
          noLabel: 'No',
          validation: { required: true },
        };
        break;
      case 'dropdown':
        newStep = {
          ...newStep,
          title: 'Select an option from the list',
          dropdownPlaceholder: 'Choose an option...',
          options: [
            { id: 'opt-' + Date.now() + '-1', label: 'Option 1' },
            { id: 'opt-' + Date.now() + '-2', label: 'Option 2' },
            { id: 'opt-' + Date.now() + '-3', label: 'Option 3' },
            { id: 'opt-' + Date.now() + '-4', label: 'Option 4' },
          ],
          validation: { required: true },
        };
        break;
      case 'file_upload':
        newStep = {
          ...newStep,
          title: 'Upload your document or attachment',
          fileMaxSizeBytes: 10 * 1024 * 1024,
          fileAllowedExtensions: ['pdf', 'png', 'jpg', 'docx'],
          validation: { required: false },
        };
        break;
      case 'website':
        newStep = {
          ...newStep,
          title: 'What is your organization or portfolio website?',
          placeholder: 'example.com',
          validation: { required: false },
        };
        break;
      case 'statement':
        newStep = {
          ...newStep,
          title: 'Important instructions or overview',
          description: 'Please read through carefully before continuing.',
          buttonLabel: 'Continue',
          validation: { required: false },
        };
        break;
      case 'thank_you':
        newStep = {
          ...newStep,
          title: form.thankYou?.title || 'Thank you for submitting!',
          description: form.thankYou?.message || 'Your response has been securely recorded.',
          buttonLabel: form.thankYou?.buttonLabel || 'Submit Another Response',
          redirectUrl: form.thankYou?.redirectUrl || '',
          redirectButtonText: form.thankYou?.redirectButtonText || 'Continue to Website',
          autoRedirect: form.thankYou?.autoRedirect || false,
          autoRedirectDelay: form.thankYou?.autoRedirectDelay || 5,
          showRestartButton: form.thankYou?.showRestartButton ?? true,
          badgeIcon: form.thankYou?.badgeIcon || 'check',
        };
        break;
    }

    const updatedSteps =
      type === 'welcome' && !form.steps.some((s) => s.type === 'welcome')
        ? [newStep, ...form.steps]
        : [...form.steps, newStep];
    onSaveForm({ ...form, steps: updatedSteps });
    setSelectedStepId(newId);
    setActiveTab(type === 'thank_you' ? 'thank_you' : 'content');
    setMobileView('editor');
  };

  const handleUpdateThankYou = (updates: {
    title: string;
    description: string;
    buttonLabel?: string;
    redirectUrl?: string;
    redirectButtonText?: string;
    autoRedirect?: boolean;
    autoRedirectDelay?: number;
    showRestartButton?: boolean;
    badgeIcon?: 'check' | 'sparkles' | 'heart' | 'rocket' | 'thumbs_up';
  }) => {
    const updatedThankYou: ThankYouConfig = {
      title: updates.title,
      message: updates.description,
      buttonLabel: updates.buttonLabel,
      redirectUrl: updates.redirectUrl,
      redirectButtonText: updates.redirectButtonText,
      autoRedirect: updates.autoRedirect,
      autoRedirectDelay: updates.autoRedirectDelay,
      showRestartButton: updates.showRestartButton,
      badgeIcon: updates.badgeIcon,
    };

    const thankYouStepIndex = form.steps.findIndex((s) => s.type === 'thank_you');
    let updatedSteps = [...form.steps];

    const existingThankYouStep = updatedSteps[thankYouStepIndex];
    if (thankYouStepIndex !== -1 && existingThankYouStep) {
      updatedSteps[thankYouStepIndex] = {
        ...existingThankYouStep,
        title: updates.title,
        description: updates.description,
        buttonLabel: updates.buttonLabel,
        redirectUrl: updates.redirectUrl,
        redirectButtonText: updates.redirectButtonText,
        autoRedirect: updates.autoRedirect,
        autoRedirectDelay: updates.autoRedirectDelay,
        showRestartButton: updates.showRestartButton,
        badgeIcon: updates.badgeIcon,
      };
    }

    onSaveForm({
      ...form,
      thankYou: updatedThankYou,
      steps: updatedSteps,
      updatedAt: 'Just now',
    });
  };

  const handleAddThankYouScreen = () => {
    const existingThanks = form.steps.find((s) => s.type === 'thank_you');
    if (existingThanks) {
      setSelectedStepId(existingThanks.id);
      setActiveTab('thank_you');
      setMobileView('editor');
      return;
    }
    const newId = 'step-thankyou-' + Date.now();
    const thankYouStep: FormStep = {
      id: newId,
      type: 'thank_you',
      title: form.thankYou?.title || 'Thank you for your response!',
      description: form.thankYou?.message || 'Your answers have been recorded. We appreciate you taking the time to share your perspective.',
      buttonLabel: form.thankYou?.buttonLabel || 'Submit Another Response',
      redirectUrl: form.thankYou?.redirectUrl || '',
      redirectButtonText: form.thankYou?.redirectButtonText || 'Continue to Website',
      autoRedirect: form.thankYou?.autoRedirect || false,
      autoRedirectDelay: form.thankYou?.autoRedirectDelay || 5,
      showRestartButton: form.thankYou?.showRestartButton ?? true,
      badgeIcon: form.thankYou?.badgeIcon || 'check',
      validation: { required: false },
    };
    onSaveForm({
      ...form,
      steps: [...form.steps, thankYouStep],
      updatedAt: 'Just now',
    });
    setSelectedStepId(newId);
    setActiveTab('thank_you');
    setMobileView('editor');
  };

  const handleAddWelcomeScreen = () => {
    const newId = 'step-welcome-' + Date.now();
    const welcomeStep: FormStep = {
      id: newId,
      type: 'welcome',
      title: 'Welcome to this form',
      description: 'Takes about 2 minutes to complete. Please take your time to answer.',
      buttonLabel: 'Get Started',
      timeEstimate: 'Takes ~2 mins',
      tagline: 'Quick Feedback',
      validation: { required: false },
    };
    const updatedSteps = [welcomeStep, ...form.steps];
    onSaveForm({
      ...form,
      welcomeScreen: {
        ...(form.welcomeScreen || {}),
        enabled: true,
        title: welcomeStep.title,
        description: welcomeStep.description,
        buttonLabel: welcomeStep.buttonLabel,
        timeEstimate: welcomeStep.timeEstimate,
        tagline: welcomeStep.tagline,
      },
      steps: updatedSteps,
      updatedAt: 'Just now',
    });
    setSelectedStepId(newId);
    setActiveTab('welcome');
    setMobileView('editor');
  };

  const handleDeleteStep = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (form.steps.length <= 1) return;
    const updatedSteps = form.steps.filter((s) => s.id !== id);
    onSaveForm({ ...form, steps: updatedSteps });
    if (selectedStepId === id) {
      setSelectedStepId(updatedSteps[0]?.id || '');
    }
  };

  const handleDuplicateStep = (step: FormStep, e: React.MouseEvent) => {
    e.stopPropagation();
    const cloned: FormStep = {
      ...step,
      id: 'step-' + Date.now(),
      title: `${step.title} (Copy)`,
    };
    const idx = form.steps.findIndex((s) => s.id === step.id);
    const updated = [...form.steps];
    updated.splice(idx + 1, 0, cloned);
    onSaveForm({ ...form, steps: updated });
    setSelectedStepId(cloned.id);
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === form.steps.length - 1)
    )
      return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSteps = [...form.steps];
    const [moved] = newSteps.splice(idx, 1);
    if (!moved) return;
    newSteps.splice(targetIdx, 0, moved);
    onSaveForm({ ...form, steps: newSteps, updatedAt: 'Just now' });
  };

  // Drag-and-drop event handlers for reordering form steps
  const handleStepDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedStepIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleStepDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedStepIdx === null || draggedStepIdx === idx) {
      if (draggedStepIdx === idx) {
        setDragOverStepIdx(null);
        setDropIndicatorPos(null);
      }
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverStepIdx(idx);
    setDropIndicatorPos(pos);
  };

  const handleStepDragLeave = (e: React.DragEvent) => {
    const currentTarget = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node | null;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverStepIdx(null);
      setDropIndicatorPos(null);
    }
  };

  const handleStepDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedStepIdx === null) return;
    const sourceIdx = draggedStepIdx;
    const pos = dropIndicatorPos || 'below';

    setDraggedStepIdx(null);
    setDragOverStepIdx(null);
    setDropIndicatorPos(null);

    if (sourceIdx === targetIdx) return;

    const newSteps = [...form.steps];
    const [movedStep] = newSteps.splice(sourceIdx, 1);
    if (!movedStep) return;

    let finalIdx = targetIdx;
    if (sourceIdx < targetIdx) {
      finalIdx = pos === 'above' ? targetIdx - 1 : targetIdx;
    } else {
      finalIdx = pos === 'above' ? targetIdx : targetIdx + 1;
    }

    finalIdx = Math.max(0, Math.min(finalIdx, newSteps.length));
    newSteps.splice(finalIdx, 0, movedStep);

    onSaveForm({
      ...form,
      steps: newSteps,
      updatedAt: 'Just now',
    });
  };

  const handleStepDragEnd = () => {
    setDraggedStepIdx(null);
    setDragOverStepIdx(null);
    setDropIndicatorPos(null);
  };

  const handleCopyShareLink = async () => {
    const success = await copyToClipboard(sharableUrl);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    }
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(form, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${form.id}-qubform.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getStepIcon = (type: QuestionType) => {
    switch (type) {
      case 'welcome':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'short_text':
        return <Type className="w-3.5 h-3.5" />;
      case 'long_text':
        return <AlignLeft className="w-3.5 h-3.5" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5" />;
      case 'phone':
        return <Phone className="w-3.5 h-3.5" />;
      case 'multiple_choice':
        return <ListOrdered className="w-3.5 h-3.5" />;
      case 'rating':
        return <Star className="w-3.5 h-3.5" />;
      case 'opinion_scale':
        return <SlidersHorizontal className="w-3.5 h-3.5" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'yes_no':
        return <ToggleLeft className="w-3.5 h-3.5" />;
      case 'dropdown':
        return <ChevronDown className="w-3.5 h-3.5" />;
      case 'file_upload':
        return <Upload className="w-3.5 h-3.5" />;
      case 'website':
        return <Globe className="w-3.5 h-3.5" />;
      case 'thank_you':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      default:
        return <Type className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-slate-50 overflow-hidden relative">
      {/* Builder Subheader */}
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200/90 z-20 shrink-0 gap-2 sm:gap-3 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <input
            type="text"
            value={form.title}
            onChange={(e) => onSaveForm({ ...form, title: e.target.value })}
            className="font-headline-sm text-sm sm:text-base font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none transition-colors px-1.5 py-0.5 rounded-md hover:bg-slate-50 max-w-[170px] sm:max-w-sm"
            placeholder="Form Title"
          />
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono-code font-medium border border-slate-200/60 shrink-0">
            {form.steps.length} {form.steps.length === 1 ? 'step' : 'steps'}
          </span>

          {/* Auto-save & Status Indicator in Subheader */}
          <button
            type="button"
            id="indicator-changes-saved-status"
            onClick={() => (saveStatus === 'error' ? onForceSave() : setIsOfflineModalOpen(true))}
            title={
              saveStatus === 'error'
                ? 'Save failed — click to retry'
                : 'Click to view offline draft persistence and revision history'
            }
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-code border transition-all duration-200 cursor-pointer select-none shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${!isOnline
                ? 'bg-amber-100/90 border-amber-300 text-amber-900 hover:bg-amber-200/80'
                : saveStatus === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  : saveStatus === 'saving'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : saveStatus === 'pending'
                      ? 'bg-amber-50/90 border-amber-200 text-amber-800 hover:bg-amber-100'
                      : 'bg-slate-100/80 hover:bg-slate-200/70 border-slate-200 text-slate-600'
              }`}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-amber-900">
                  Offline · Draft Saved
                </span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-[11px] font-semibold text-rose-700">Save failed · Retry</span>
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                <span className="text-[11px] font-medium text-blue-700">Saving…</span>
              </>
            ) : saveStatus === 'pending' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <span className="text-[11px] text-amber-700 font-medium">Unsaved changes</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-600">
                  {lastSavedAt ? `Saved (${formatRelativeDraftTime(lastSavedAt)})` : 'Saved'}
                </span>
              </>
            )}
          </button>

          {/* Quick link indicator badge */}
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 text-xs font-mono-code transition cursor-pointer border border-slate-200/70 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            title="Click to open share and embed options"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-[140px]">/f/{form.id}</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Form Status Selector */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80">
            <select
              value={form.status || 'published'}
              onChange={(e) => {
                const newStatus = e.target.value as 'published' | 'draft' | 'closed';
                onSaveForm({ ...form, status: newStatus, updatedAt: 'Just now' });
              }}
              aria-label="Form publication status"
              className="bg-transparent text-xs font-semibold px-2 py-1 rounded text-slate-700 outline-none cursor-pointer focus-visible:ring-1 focus-visible:ring-indigo-600"
            >
              <option value="published">🟢 Published</option>
              <option value="draft">🟡 Draft</option>
              <option value="closed">⚪ Closed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Prominent Copy Link Button */}
          <button
            id="btn-copy-form-link"
            onClick={handleCopyShareLink}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${isCopied
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            title="Copy unique form URL for sharing"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* Full Share Modal Button */}
          <button
            id="btn-open-share-modal"
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            title="Open sharing & embedding options"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Logic Flow Diagram Header Toggle */}
          <button
            type="button"
            id="btn-toggle-logic-flow-header"
            onClick={() => {
              setCanvasMode((prev) => (prev === 'logic_flow' ? 'preview' : 'logic_flow'));
              setMobileView('preview');
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${canvasMode === 'logic_flow'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
            title="View conditional branching logic tree diagram"
          >
            <GitBranch className={`w-3.5 h-3.5 ${canvasMode === 'logic_flow' ? 'text-white' : 'text-emerald-600'}`} />
            <span className="hidden sm:inline">Logic Flow</span>
            {hasConditionalLogic && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${canvasMode === 'logic_flow' ? 'bg-white' : 'bg-emerald-500 animate-pulse'
                  }`}
              />
            )}
          </button>

          <button
            type="button"
            id="btn-header-draft-history"
            onClick={() => setIsOfflineModalOpen(true)}
            title="Inspect offline draft snapshots, storage diagnostics, and revision history"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Drafts</span>
          </button>

          <button
            onClick={handleExportJSON}
            title="Download form schema JSON"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            onClick={onLaunchFullscreenDemo}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs shadow-indigo-600/20 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Launch Live Form</span>
            <span className="sm:hidden">Live</span>
          </button>
        </div>
      </div>

      {/* Draft Recovery Notification Banner */}
      {recoveredDraft && recoveredDraft.promptVisible && (
        <div
          id="banner-draft-recovery"
          className="bg-amber-50/95 border-b border-amber-200/90 px-4 sm:px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2.5 text-amber-950 z-20 shrink-0 shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300/60 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </span>
            <span>
              <strong>Draft Available:</strong> An auto-saved draft from{' '}
              {formatRelativeDraftTime(recoveredDraft.draft.timestamp)} with{' '}
              {recoveredDraft.draft.stepCount} steps was recovered.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-restore-draft"
              onClick={handleRestoreDraft}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              Restore Draft
            </button>
            <button
              type="button"
              id="btn-discard-draft"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 font-medium text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Form Sharable Collection Banner */}
      <div className="hidden bg-white/80 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs shrink-0">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unique Sharable Link:</span>
          </span>
          <div
            onClick={handleCopyShareLink}
            title="Click to copy unique link"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono-code text-[11px] truncate transition cursor-pointer max-w-xs sm:max-w-md shadow-2xs"
          >
            <span className="truncate">{sharableUrl}</span>
            <Copy className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyShareLink}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${isCopied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-medium transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Share & Embed</span>
          </button>
        </div>
      </div>

      {/* Mobile Ergonomic Segmented View Switcher (< lg screens) */}
      <div
        id="mobile-builder-view-switcher"
        className="flex lg:hidden items-center justify-around border-b border-slate-200/90 bg-white px-2 py-1.5 shrink-0 select-none z-10 shadow-2xs"
      >
        <button
          type="button"
          id="tab-mobile-outline"
          onClick={() => setMobileView('outline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${mobileView === 'outline'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-600'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Outline ({form.steps.length})</span>
        </button>
        <button
          type="button"
          id="tab-mobile-editor"
          onClick={() => setMobileView('editor')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${mobileView === 'editor'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-600'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Edit Step</span>
        </button>
        <button
          type="button"
          id="tab-mobile-preview"
          onClick={() => {
            setMobileView('preview');
            setCanvasMode('preview');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${mobileView === 'preview' && canvasMode === 'preview'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-600'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>
        <button
          type="button"
          id="tab-mobile-logic-flow"
          onClick={() => {
            setMobileView('preview');
            setCanvasMode('logic_flow');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${canvasMode === 'logic_flow' && mobileView === 'preview'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Logic Flow</span>
        </button>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Column 1: Steps Hierarchy & Step Adder (Left 320px) */}
        <div
          className={`w-full lg:w-80 xl:w-90 bg-white border-r border-slate-200/90 flex-col shrink-0 h-auto lg:h-full overflow-y-auto pb-24 lg:pb-0 ${mobileView === 'outline' ? 'flex' : 'hidden lg:flex'
            }`}
        >
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono-code">
                Form Outline
              </span>
              <span className="text-[11px] font-mono-code font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                {form.steps.length}
              </span>
            </div>
            <button
              type="button"
              id="btn-outline-header-add-question"
              onClick={() => setIsAddStepDialogOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-2xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              title="Add a new question or step"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Drag & Drop Reorder notice bar */}
          <div className="px-3.5 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono-code select-none">
            <span className="flex items-center gap-1.5 text-slate-600">
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
              <span>Drag handle to reorder</span>
            </span>
            {draggedStepIdx !== null ? (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md animate-pulse">
                Moving #{draggedStepIdx + 1}
              </span>
            ) : (
              <span className="text-slate-400 text-[10px]">
                {form.steps.length} {form.steps.length === 1 ? 'step' : 'steps'}
              </span>
            )}
          </div>

          {/* Welcome Screen Card in Outline */}
          <div className="p-2 border-b border-slate-100 bg-amber-50/30">
            {form.steps.some((s) => s.type === 'welcome') || form.welcomeScreen?.enabled ? (
              <button
                type="button"
                id="btn-outline-welcome-screen"
                onClick={() => {
                  const welcomeStep = form.steps.find((s) => s.type === 'welcome');
                  if (welcomeStep) {
                    setSelectedStepId(welcomeStep.id);
                  }
                  setActiveTab('welcome');
                  setMobileView('editor');
                }}
                className={`w-full p-2.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${activeTab === 'welcome' || currentStep?.type === 'welcome'
                    ? 'bg-indigo-50 text-indigo-900 border-2 border-indigo-600 shadow-xs ring-1 ring-indigo-600/10'
                    : 'bg-white hover:bg-amber-50/80 border-amber-200/70 text-slate-800 shadow-2xs'
                  }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'welcome' || currentStep?.type === 'welcome'
                        ? 'bg-slate-800 text-amber-400'
                        : 'bg-amber-100 text-amber-700'
                      }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div className="truncate">
                    <div className="text-xs font-semibold leading-tight">Welcome Screen</div>
                    <div
                      className={`text-[10px] truncate leading-tight mt-0.5 ${activeTab === 'welcome' || currentStep?.type === 'welcome'
                          ? 'text-indigo-600/80'
                          : 'text-slate-500'
                        }`}
                    >
                      {form.steps.find((s) => s.type === 'welcome')?.title || 'Greeting & Hero Banner'}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 pl-1">
                  <span className="text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700">
                    INTRO
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                id="btn-add-welcome-screen-outline"
                onClick={handleAddWelcomeScreen}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-300 hover:border-amber-400 bg-white hover:bg-amber-50 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>+ Add Welcome Screen</span>
              </button>
            )}
          </div>

          {/* Drag-and-Drop Steps List */}
          <div
            className="flex-1 overflow-y-auto p-2 space-y-1"
            onDragOver={(e) => e.preventDefault()}
          >
            {form.steps.map((step, idx) => {
              const isSelected = step.id === currentStep?.id;
              const isBeingDragged = draggedStepIdx === idx;
              const isDropTargetAbove = dragOverStepIdx === idx && dropIndicatorPos === 'above';
              const isDropTargetBelow = dragOverStepIdx === idx && dropIndicatorPos === 'below';
              const hasLogicRules = Boolean(
                step.logic?.enabled && (step.logic.rules?.length || 0) > 0
              );

              return (
                <div key={step.id} className="relative group/step">
                  {/* Visual Drop Insertion Line (Above) */}
                  {isDropTargetAbove && (
                    <div className="flex items-center gap-1.5 py-1 px-1 my-0.5 animate-pulse select-none">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0" />
                      <div className="h-0.5 flex-1 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-mono-code font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        Move to #{idx + 1}
                      </span>
                    </div>
                  )}

                  <div
                    id={`step-outline-item-${step.id}`}
                    draggable={true}
                    onDragStart={(e) => handleStepDragStart(e, idx)}
                    onDragOver={(e) => handleStepDragOver(e, idx)}
                    onDragLeave={handleStepDragLeave}
                    onDrop={(e) => handleStepDrop(e, idx)}
                    onDragEnd={handleStepDragEnd}
                    onClick={() => {
                      setSelectedStepId(step.id);
                      setMobileView('editor');
                      if (step.type === 'thank_you') {
                        setActiveTab('thank_you');
                      } else if (activeTab === 'thank_you') {
                        setActiveTab('content');
                      }
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition select-none ${isBeingDragged
                        ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-400/50 scale-[0.98]'
                        : isSelected
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-600 shadow-sm ring-1 ring-indigo-600/10'
                          : 'bg-white hover:bg-slate-50/90 border-slate-200/70 hover:border-slate-300 text-slate-700 shadow-2xs'
                      }`}
                  >
                    {/* Drag Handle & Step Details */}
                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-1.5">
                      <span
                        title="Click and drag to reorder this question"
                        className={`p-1 rounded-md cursor-grab active:cursor-grabbing hover:bg-slate-200/50 transition shrink-0 ${isSelected
                            ? 'text-indigo-500 hover:text-white hover:bg-indigo-600'
                            : 'text-slate-400 hover:text-slate-800'
                          }`}
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>

                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                          }`}
                      >
                        {getStepIcon(step.type)}
                      </span>

                      <span className="font-medium truncate">
                        <span className="font-mono-code text-[11px] text-slate-400 mr-1">{idx + 1}.</span>
                        {step.title || 'Untitled Step'}
                      </span>

                      {step.type === 'welcome' && (
                        <span
                          className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${isSelected
                              ? 'bg-amber-400/20 text-amber-700'
                              : 'bg-amber-100 text-amber-800'
                            }`}
                        >
                          Intro
                        </span>
                      )}
                      {step.type === 'thank_you' && (
                        <span
                          className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${isSelected
                              ? 'bg-emerald-400/20 text-emerald-700'
                              : 'bg-emerald-100 text-emerald-800'
                            }`}
                        >
                          {step.redirectUrl ? 'Redirect' : 'Ending'}
                        </span>
                      )}
                      {hasLogicRules && (
                        <span
                          title={`Conditional branching active: ${step.logic?.rules?.length} rule(s)`}
                          className={`flex items-center gap-0.5 text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isSelected
                              ? 'bg-white text-emerald-700 border border-emerald-300'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            }`}
                        >
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>{step.logic?.rules?.length}</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons (Chevron Up/Down, Duplicate, Delete) */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover/step:opacity-100 transition shrink-0"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => handleMoveStep(idx, 'up', e)}
                        title="Move Up"
                        className={`p-1 rounded-md hover:bg-slate-200/50 disabled:opacity-20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${isSelected ? 'hover:bg-indigo-100 text-indigo-600' : 'text-slate-500'
                          }`}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.steps.length - 1}
                        onClick={(e) => handleMoveStep(idx, 'down', e)}
                        title="Move Down"
                        className={`p-1 rounded-md hover:bg-slate-200/50 disabled:opacity-20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${isSelected ? 'hover:bg-indigo-100 text-indigo-600' : 'text-slate-500'
                          }`}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateStep(step, e)}
                        title="Duplicate"
                        className={`p-1 rounded-md hover:bg-slate-200/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${isSelected ? 'hover:bg-indigo-100 text-indigo-600' : 'text-slate-500'
                          }`}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {form.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteStep(step.id, e)}
                          title="Delete"
                          className="p-1 rounded-md hover:bg-rose-500/20 text-rose-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Drop Insertion Line (Below) */}
                  {isDropTargetBelow && (
                    <div className="flex items-center gap-1.5 py-1 px-1 my-0.5 animate-pulse select-none">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0" />
                      <div className="h-0.5 flex-1 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-mono-code font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        Move to #{idx + 2 > form.steps.length ? form.steps.length : idx + 2}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dedicated Post-Submission Screen Banner */}
          <div className="p-2 border-t border-slate-100 bg-emerald-50/30">
            <button
              type="button"
              id="btn-outline-thank-you-screen"
              onClick={() => {
                const thankStep = form.steps.find((s) => s.type === 'thank_you');
                if (thankStep) {
                  setSelectedStepId(thankStep.id);
                }
                setActiveTab('thank_you');
              }}
              className={`w-full p-2.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${activeTab === 'thank_you' || currentStep?.type === 'thank_you'
                  ? 'bg-indigo-50 text-indigo-900 border-2 border-indigo-600 shadow-xs ring-1 ring-indigo-600/10'
                  : 'bg-white hover:bg-emerald-50/80 border-emerald-200/70 text-slate-800 shadow-2xs'
                }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'thank_you' || currentStep?.type === 'thank_you'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-700'
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight">Thank You & Redirect</div>
                  <div
                    className={`text-[10px] truncate leading-tight mt-0.5 ${activeTab === 'thank_you' || currentStep?.type === 'thank_you'
                        ? 'text-indigo-600/80'
                        : 'text-slate-500'
                      }`}
                  >
                    {form.steps.find((s) => s.type === 'thank_you')?.redirectUrl ||
                      form.thankYou?.redirectUrl
                      ? 'Redirects after submit'
                      : 'Custom ending message'}
                  </div>
                </div>
              </div>
              {(form.steps.find((s) => s.type === 'thank_you')?.redirectUrl ||
                form.thankYou?.redirectUrl) && (
                  <span className="text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0">
                    URL
                  </span>
                )}
            </button>
          </div>

          {/* Quick Settings, Design, Branding & Notifications cards at outline bottom */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/60 mt-auto space-y-1.5">
            {/* Theme & Background Design Shortcut */}
            <button
              type="button"
              id="btn-outline-theme-design"
              onClick={() => {
                setActiveTab('theme');
                setMobileView('editor');
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${activeTab === 'theme'
                  ? 'bg-indigo-50 text-indigo-900 border-2 border-indigo-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'theme' ? 'bg-slate-800 text-white' : 'bg-purple-100 text-purple-700'
                    }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight">Theme Settings</div>
                  <div className={`text-[10px] truncate leading-tight mt-0.5 ${activeTab === 'theme' ? 'text-indigo-600/80' : 'text-slate-500'}`}>
                    Color, Font & Radius
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Branding & Customer Footer Shortcut */}
            <button
              type="button"
              id="btn-outline-branding-footer"
              onClick={() => {
                setActiveTab('branding');
                setMobileView('editor');
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${activeTab === 'branding'
                  ? 'bg-indigo-50 text-indigo-900 border-2 border-indigo-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'branding' ? 'bg-slate-800 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                >
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight">Branding & Footer</div>
                  <div className={`text-[10px] truncate leading-tight mt-0.5 ${activeTab === 'branding' ? 'text-indigo-600/80' : 'text-slate-500'}`}>
                    {form.header?.brandName || 'Logo, Header & Footer'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Email Alerts Shortcut */}
            <button
              type="button"
              id="btn-outline-notifications"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between shadow-2xs bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${form.notifications?.enabled && form.notifications?.recipientEmail
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight">Email Alerts</div>
                  <div className="text-[10px] truncate leading-tight mt-0.5 text-slate-500">
                    {form.notifications?.enabled && form.notifications?.recipientEmail
                      ? form.notifications.recipientEmail
                      : 'Response Notifications'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 pl-1">
                {form.notifications?.enabled && form.notifications?.recipientEmail ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Offline & Drafts Storage Shortcut */}
            <button
              type="button"
              id="btn-outline-offline-drafts"
              onClick={() => setIsOfflineModalOpen(true)}
              className="w-full p-2.5 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-left transition cursor-pointer flex items-center justify-between shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${!isOnline ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                >
                  {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                    <span>Drafts & Offline</span>
                    {!isOnline && (
                      <span className="text-[9px] font-mono-code font-bold px-1 rounded bg-amber-200 text-amber-900">
                        OFFLINE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {!isOnline ? 'Local storage active' : 'Revisions & backup manager'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* Column 2: Step Editor & Validation Rule Panel (Middle 380px) */}
        <div
          className={`w-full lg:w-160 bg-white border-r border-slate-200/90 flex-col shrink-0 overflow-y-auto pb-24 lg:pb-0 ${mobileView === 'editor' ? 'flex' : 'hidden lg:flex'
            }`}
        >
          {/* Editor Tabs: Content vs Validation vs Branching Logic vs Thank You vs Theme vs Notifications */}
          <div className="flex items-center border-b border-slate-200/80 bg-slate-50/70 px-3 pt-2 overflow-x-auto no-scrollbar gap-1">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'content'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              Content
            </button>
            <button
              id="tab-btn-welcome"
              onClick={() => {
                setActiveTab('welcome');
                const welcomeStep = form.steps.find((s) => s.type === 'welcome');
                if (welcomeStep) setSelectedStepId(welcomeStep.id);
              }}
              className={`hidden flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'welcome'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Welcome Screen</span>
              {(form.steps.some((s) => s.type === 'welcome') || form.welcomeScreen?.enabled) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
              )}
            </button>
            <button
              id="tab-btn-validation"
              onClick={() => setActiveTab('validation')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'validation'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
              <span>Validation</span>
              {(currentStep?.validation?.required ||
                currentStep?.validation?.pattern ||
                currentStep?.validation?.minLength ||
                currentStep?.validation?.maxLength) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-200" />
                )}
            </button>
            <button
              onClick={() => setActiveTab('logic')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'logic'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Logic & Branching</span>
              {currentStep?.logic?.enabled && (currentStep.logic.rules?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono-code bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  {currentStep.logic.rules?.length}
                </span>
              )}
            </button>
            <button
              id="tab-btn-thank-you"
              onClick={() => setActiveTab('thank_you')}
              className={`hidden flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'thank_you'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thank You & Redirect</span>
              {(form.steps.some((s) => s.type === 'thank_you' && s.redirectUrl) ||
                form.thankYou?.redirectUrl) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                )}
            </button>
            <button
              id="tab-btn-theme"
              onClick={() => setActiveTab('theme')}
              className={`hidden flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'theme'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span>Theme Settings</span>
              {form.customPalette?.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 ring-2 ring-purple-200" />
              )}
            </button>
            <button
              id="tab-btn-branding"
              onClick={() => setActiveTab('branding')}
              className={`hidden flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${activeTab === 'branding'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Building className="w-3.5 h-3.5 text-blue-600" />
              <span>Branding & Footer</span>
              {(form.header?.enabled || form.footer?.enabled) && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-blue-200" />
              )}
            </button>
            <button
              id="tab-btn-notifications"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="hidden flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold tracking-tight border-b-2 transition whitespace-nowrap cursor-pointer border-transparent text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Email Alerts</span>
              {form.notifications?.enabled && form.notifications?.recipientEmail && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-200" />
              )}
            </button>
          </div>

          <div className="p-5 flex-1 space-y-5 overflow-y-auto">
            {/* If welcome tab is active, or content tab is active and current step is welcome */}
            {((activeTab === 'content' && currentStep?.type === 'welcome') ||
              activeTab === 'welcome') && (
                <WelcomeScreenEditor
                  form={form}
                  onUpdateForm={(updated) => onSaveForm(updated)}
                  onPreviewWelcomeScreen={() => {
                    const welcomeStep = form.steps.find((s) => s.type === 'welcome');
                    if (welcomeStep) setSelectedStepId(welcomeStep.id);
                    setCanvasMode('preview');
                    setMobileView('preview');
                  }}
                />
              )}

            {/* If content tab is active and current step is thank_you */}
            {activeTab === 'content' && currentStep?.type === 'thank_you' && (
              <ThankYouEditor
                form={form}
                thankYouStep={currentStep}
                onUpdateThankYou={handleUpdateThankYou}
                onAddThankYouStep={handleAddThankYouScreen}
              />
            )}

            {activeTab === 'content' && currentStep && currentStep.type !== 'thank_you' && currentStep.type !== 'welcome' && (
              <>
                {/* Type badge & ID chip */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-900" />
                    <span className="uppercase tracking-wider font-mono-code font-semibold text-slate-800 text-[11px]">
                      Type: {currentStep.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="font-mono-code text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                    ID: {currentStep.id}
                  </span>
                </div>

                {/* Prompt Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Question Headline
                  </label>
                  <textarea
                    rows={2}
                    value={currentStep.title}
                    onChange={(e) => handleUpdateStep({ title: e.target.value })}
                    className="w-full text-sm border border-slate-200/90 rounded-xl p-3 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition resize-none font-medium bg-white placeholder:text-slate-400"
                    placeholder="Enter question text..."
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Description / Helper Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentStep.description || ''}
                    onChange={(e) => handleUpdateStep({ description: e.target.value })}
                    className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white placeholder:text-slate-400"
                    placeholder="Provide subtle context or instructions..."
                  />
                </div>

                {/* Placeholder (if applicable) */}
                {(currentStep.type === 'short_text' ||
                  currentStep.type === 'long_text' ||
                  currentStep.type === 'email' ||
                  currentStep.type === 'phone') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Input Placeholder
                      </label>
                      <input
                        type="text"
                        value={currentStep.placeholder || ''}
                        onChange={(e) => handleUpdateStep({ placeholder: e.target.value })}
                        className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white placeholder:text-slate-400"
                        placeholder="e.g. Type your answer..."
                      />
                    </div>
                  )}

                {/* Multiple choice options editor */}
                {currentStep.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-800">
                      Options & Shortcuts
                    </label>
                    <div className="space-y-2">
                      {(currentStep.options || []).map((opt, optIdx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-mono-code text-xs font-bold text-slate-700 shrink-0">
                            {opt.keyHint || String.fromCharCode(65 + optIdx)}
                          </span>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(currentStep.options || [])];
                              const opt = newOpts[optIdx];
                              if (!opt) return;
                              newOpts[optIdx] = { ...opt, label: e.target.value };
                              handleUpdateStep({ options: newOpts });
                            }}
                            className="flex-1 text-xs border border-slate-200/90 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none bg-white transition"
                          />
                          {(currentStep.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = (currentStep.options || []).filter(
                                  (_, i) => i !== optIdx
                                );
                                handleUpdateStep({ options: newOpts });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                              title="Delete option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newKey = String.fromCharCode(
                          65 + (currentStep.options?.length || 0)
                        );
                        const newOpts = [
                          ...(currentStep.options || []),
                          {
                            id: 'opt-' + Date.now(),
                            label: `Option ${(currentStep.options?.length || 0) + 1}`,
                            keyHint: newKey,
                          },
                        ];
                        handleUpdateStep({ options: newOpts });
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center justify-center gap-1.5 transition mt-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add another choice
                    </button>
                  </div>
                )}

                {/* Dropdown Options Editor */}
                {currentStep.type === 'dropdown' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Dropdown Placeholder
                      </label>
                      <input
                        type="text"
                        value={currentStep.dropdownPlaceholder || ''}
                        onChange={(e) =>
                          handleUpdateStep({ dropdownPlaceholder: e.target.value })
                        }
                        className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white placeholder:text-slate-400"
                        placeholder="e.g. Choose from the list..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-2">
                        Dropdown Menu Options
                      </label>
                      <div className="space-y-2">
                        {(currentStep.options || []).map((opt, optIdx) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-mono-code text-xs font-semibold text-slate-500 shrink-0">
                              {optIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const newOpts = [...(currentStep.options || [])];
                                const opt = newOpts[optIdx];
                                if (!opt) return;
                                newOpts[optIdx] = { ...opt, label: e.target.value };
                                handleUpdateStep({ options: newOpts });
                              }}
                              className="flex-1 text-xs border border-slate-200/90 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none bg-white transition"
                            />
                            {(currentStep.options || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = (currentStep.options || []).filter(
                                    (_, i) => i !== optIdx
                                  );
                                  handleUpdateStep({ options: newOpts });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                                title="Delete option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [
                            ...(currentStep.options || []),
                            {
                              id: 'opt-' + Date.now(),
                              label: `Option ${(currentStep.options?.length || 0) + 1}`,
                            },
                          ];
                          handleUpdateStep({ options: newOpts });
                        }}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center justify-center gap-1.5 transition mt-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another dropdown option
                      </button>
                    </div>
                  </div>
                )}

                {/* Number / Amount Editor */}
                {currentStep.type === 'number' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Prefix (Currency/Symbol)
                        </label>
                        <input
                          type="text"
                          value={currentStep.numberPrefix || ''}
                          onChange={(e) => handleUpdateStep({ numberPrefix: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="e.g. $, €, £, #"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Suffix (Units)
                        </label>
                        <input
                          type="text"
                          value={currentStep.numberSuffix || ''}
                          onChange={(e) => handleUpdateStep({ numberSuffix: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="e.g. USD, %, kg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Minimum
                        </label>
                        <input
                          type="number"
                          value={currentStep.numberMin ?? ''}
                          onChange={(e) =>
                            handleUpdateStep({
                              numberMin: e.target.value !== '' ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Maximum
                        </label>
                        <input
                          type="number"
                          value={currentStep.numberMax ?? ''}
                          onChange={(e) =>
                            handleUpdateStep({
                              numberMax: e.target.value !== '' ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="100000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Increment
                        </label>
                        <input
                          type="number"
                          value={currentStep.numberStep ?? 1}
                          onChange={(e) =>
                            handleUpdateStep({
                              numberStep: Number(e.target.value) || 1,
                            })
                          }
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Picker Editor */}
                {currentStep.type === 'date' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Earliest Allowed Date
                        </label>
                        <input
                          type="date"
                          value={currentStep.dateMin || ''}
                          onChange={(e) => handleUpdateStep({ dateMin: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Latest Allowed Date
                        </label>
                        <input
                          type="date"
                          value={currentStep.dateMax || ''}
                          onChange={(e) => handleUpdateStep({ dateMax: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Yes / No Toggle Editor */}
                {currentStep.type === 'yes_no' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Affirmative Label
                        </label>
                        <input
                          type="text"
                          value={currentStep.yesLabel || 'Yes'}
                          onChange={(e) => handleUpdateStep({ yesLabel: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="Yes / Agree / Accept"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Negative Label
                        </label>
                        <input
                          type="text"
                          value={currentStep.noLabel || 'No'}
                          onChange={(e) => handleUpdateStep({ noLabel: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="No / Disagree / Decline"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload Editor */}
                {currentStep.type === 'file_upload' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Maximum File Size
                      </label>
                      <select
                        value={currentStep.fileMaxSizeBytes || 10 * 1024 * 1024}
                        onChange={(e) =>
                          handleUpdateStep({ fileMaxSizeBytes: Number(e.target.value) })
                        }
                        className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition cursor-pointer"
                      >
                        <option value={2 * 1024 * 1024}>2 MB</option>
                        <option value={5 * 1024 * 1024}>5 MB</option>
                        <option value={10 * 1024 * 1024}>10 MB (Default)</option>
                        <option value={25 * 1024 * 1024}>25 MB</option>
                        <option value={50 * 1024 * 1024}>50 MB</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Allowed Extensions (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(currentStep.fileAllowedExtensions || ['pdf', 'png', 'jpg', 'docx']).join(', ')}
                        onChange={(e) => {
                          const exts = e.target.value
                            .split(',')
                            .map((s) => s.trim().replace(/^\./, ''))
                            .filter(Boolean);
                          handleUpdateStep({ fileAllowedExtensions: exts });
                        }}
                        className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition font-mono-code bg-white"
                        placeholder="pdf, png, jpg, docx, zip"
                      />
                    </div>
                  </div>
                )}

                {/* Rating Max Editor */}
                {currentStep.type === 'rating' && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Max Stars
                    </label>
                    <select
                      value={currentStep.ratingMax || 5}
                      onChange={(e) => handleUpdateStep({ ratingMax: Number(e.target.value) })}
                      className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition cursor-pointer"
                    >
                      <option value={3}>3 Stars</option>
                      <option value={5}>5 Stars (Standard)</option>
                      <option value={7}>7 Stars</option>
                      <option value={10}>10 Stars</option>
                    </select>
                  </div>
                )}

                {/* Opinion Scale Editor */}
                {currentStep.type === 'opinion_scale' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Scale Range
                      </label>
                      <select
                        value={currentStep.scaleMax || 10}
                        onChange={(e) => handleUpdateStep({ scaleMax: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition cursor-pointer"
                      >
                        <option value={5}>0 to 5 (Short rating)</option>
                        <option value={10}>0 to 10 (Net Promoter Score / NPS)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Low End Label (0)
                        </label>
                        <input
                          type="text"
                          value={currentStep.scaleMinLabel || ''}
                          onChange={(e) => handleUpdateStep({ scaleMinLabel: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="e.g. Not likely"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          High End Label (10)
                        </label>
                        <input
                          type="text"
                          value={currentStep.scaleMaxLabel || ''}
                          onChange={(e) => handleUpdateStep({ scaleMaxLabel: e.target.value })}
                          className="w-full text-xs border border-slate-200/90 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:outline-none transition bg-white"
                          placeholder="e.g. Extremely likely"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VALIDATION RULES TAB */}
            {activeTab === 'validation' && currentStep && (
              <StepValidationEditor
                currentStep={currentStep}
                onUpdateStep={handleUpdateStep}
              />
            )}

            {/* BRANCHING LOGIC TAB */}
            {activeTab === 'logic' && currentStep && (
              <LogicBranchingEditor
                currentStep={currentStep}
                form={form}
                onUpdateStep={handleUpdateStep}
                onOpenFlowVisualization={() => {
                  setCanvasMode('logic_flow');
                  setMobileView('preview');
                }}
              />
            )}

            {/* THANK YOU & REDIRECT TAB */}
            {activeTab === 'thank_you' && (
              <ThankYouEditor
                form={form}
                thankYouStep={
                  currentStep?.type === 'thank_you'
                    ? currentStep
                    : form.steps.find((s) => s.type === 'thank_you')
                }
                onUpdateThankYou={handleUpdateThankYou}
                onAddThankYouStep={handleAddThankYouScreen}
              />
            )}

            {/* THEME & BACKGROUND DESIGN TAB */}
            {activeTab === 'theme' && (
              <ThemeDesignEditor
                form={form}
                onUpdateForm={(updated) =>
                  onSaveForm({
                    ...form,
                    ...updated,
                    updatedAt: 'Just now',
                  })
                }
              />
            )}

            {/* BRANDING, HEADER & CUSTOMER FOOTER TAB */}
            {activeTab === 'branding' && (
              <BrandingHeaderFooterEditor
                form={form}
                onUpdateForm={(updated) =>
                  onSaveForm({
                    ...form,
                    ...updated,
                    updatedAt: 'Just now',
                  })
                }
              />
            )}
          </div>
        </div>

        {/* Column 3: Dual-Mode Interactive Canvas (Preview or Logic Flow Tree) */}
        <div
          className={`flex-1 bg-slate-100 flex-col overflow-hidden pb-24 lg:pb-0 ${mobileView === 'preview' ? 'flex' : 'hidden lg:flex'
            }`}
        >
          {/* Canvas Mode Control Bar */}
          <div className="bg-white border-b border-slate-200/90 px-4 py-2 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                id="btn-canvas-preview"
                onClick={() => setCanvasMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${canvasMode === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-950/5'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview</span>
              </button>

              <button
                type="button"
                id="btn-canvas-logic-flow"
                onClick={() => setCanvasMode('logic_flow')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${canvasMode === 'logic_flow'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-600/10'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
                <span>Logic Flow</span>
                {logicRuleCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono-code font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {logicRuleCount}
                  </span>
                )}
              </button>
            </div>

            {/* <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
              {canvasMode === 'logic_flow' ? (
                <span>Interactive tree graph of conditional jumps</span>
              ) : (
                <span>Live responsive preview with keyboard navigation</span>
              )}
            </div> */}
          </div>

          {/* Canvas Body */}
          {canvasMode === 'logic_flow' ? (
            <div className="flex-1 overflow-hidden relative">
              <LogicFlowView
                form={form}
                selectedStepId={selectedStepId}
                onSelectStep={(stepId) => {
                  setSelectedStepId(stepId);
                  setActiveTab('logic');
                }}
                onOpenLogicTab={(stepId) => {
                  setSelectedStepId(stepId);
                  setActiveTab('logic');
                }}
              />
            </div>
          ) : (
            <DevicePreviewFrame
              device={previewDevice}
              onDeviceChange={setPreviewDevice}
              sharableUrl={sharableUrl}
            >
              <FormRespondent
                key={`${form.id}-${form.steps.length}-${form.themeId}-${selectedStepId}-${activeTab}-${form.updatedAt}`}
                form={form}
                initialStepIndex={
                  activeTab === 'welcome' || currentStep?.type === 'welcome'
                    ? 0
                    : activeTab === 'thank_you' || currentStep?.type === 'thank_you'
                      ? form.steps.findIndex((s) => s.type === 'thank_you') !== -1
                        ? form.steps.findIndex((s) => s.type === 'thank_you')
                        : form.steps.length // activates fallback/virtual thank_you step
                      : Math.max(0, selectedStepIndex)
                }
                isEmbedded={true}
                isMobilePreview={previewDevice === 'mobile'}
              />
            </DevicePreviewFrame>
          )}
        </div>
      </div>

      {/* Share & Collect Modal Dialog */}
      <ShareFormModal
        form={form}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onOpenLiveDemo={onLaunchFullscreenDemo}
      />

      {/* Add Question Type Modal Dialog */}
      <AddQuestionTypeDialog
        isOpen={isAddStepDialogOpen}
        onClose={() => setIsAddStepDialogOpen(false)}
        onSelectType={handleAddStep}
      />

      {/* Email Alerts Modal Dialog */}
      {isNotificationsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsNotificationsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-slate-900">Email Alerts</h2>
                  <p className="text-xs text-slate-500">
                    Configure response notification emails for this form
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <NotificationSettingsEditor
                form={form}
                onUpdateNotifications={(notifications) =>
                  onSaveForm({
                    ...form,
                    notifications,
                    updatedAt: 'Just now',
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Offline & Draft Persistence Manager Modal */}
      <OfflineDraftManagerModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        form={form}
        isOnline={isOnline}
        lastAutoSavedTime={lastAutoSavedTime}
        onRestoreRevision={(restored) => onSaveForm(restored)}
        onForceSave={onForceSave}
      />

      {/* Floating Action Button (FAB) for Mobile & Rapid Thumb Reachability */}
      <BuilderFAB
        onSave={onForceSave}
        onSaveAndLaunchDemo={handleSaveAndLaunchDemo}
        onCopyShareLink={handleCopyShareLink}
        onDiscardDraft={recoveredDraft ? handleDiscardDraft : undefined}
        onOpenAddQuestion={() => setIsAddStepDialogOpen(true)}
        hasDraft={Boolean(recoveredDraft || lastAutoSavedTime)}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        isCopied={isCopied}
      />
    </div>
  );
};
