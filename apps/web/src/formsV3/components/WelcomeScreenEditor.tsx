import React, { useState, useRef } from 'react';
import Markdown from '../lib/markdown';
import {
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Layout,
  Type,
  Clock,
  ArrowRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  Check,
  Plus,
  Compass,
  Upload,
  ExternalLink,
  ChevronDown,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type { FormConfig, FormStep, HeaderImageLayout, WelcomeScreenConfig } from '../types';
import {
  AI_HERO_STYLES,
  CURATED_AI_HERO_PRESETS,
  SMART_PROMPT_SUGGESTIONS,
  RICH_TEXT_SNIPPETS,
  generateAIHeroImage,
  generateAIWelcomeCopy,
} from '../utils/aiHeroGenerator';

interface WelcomeScreenEditorProps {
  form: FormConfig;
  onUpdateForm: (updatedForm: FormConfig) => void;
  onPreviewWelcomeScreen?: () => void;
}

export const WelcomeScreenEditor: React.FC<WelcomeScreenEditorProps> = ({
  form,
  onUpdateForm,
  onPreviewWelcomeScreen,
}) => {
  // Find existing welcome step in form.steps if any
  const welcomeStepIndex = form.steps.findIndex((s) => s.type === 'welcome');
  const existingStep = welcomeStepIndex !== -1 ? form.steps[welcomeStepIndex] : undefined;

  // Determine if welcome screen is enabled
  const isEnabled = Boolean(existingStep || form.welcomeScreen?.enabled);

  // Active form state values (prefer step values, then form.welcomeScreen, then defaults)
  const title = existingStep?.title ?? form.welcomeScreen?.title ?? 'Welcome to this form';
  const description =
    existingStep?.description ??
    form.welcomeScreen?.description ??
    'Thank you for taking the time to participate. Takes about 2 minutes to complete.';
  const buttonLabel = existingStep?.buttonLabel ?? form.welcomeScreen?.buttonLabel ?? 'Get Started';
  const timeEstimate = existingStep?.timeEstimate ?? form.welcomeScreen?.timeEstimate ?? 'Takes ~2 mins';
  const tagline = existingStep?.tagline ?? form.welcomeScreen?.tagline ?? 'Quick Feedback';
  const showKeyboardHint =
    existingStep?.showKeyboardHint ?? form.welcomeScreen?.showKeyboardHint ?? true;

  // Hero image state
  const headerImage = existingStep?.headerImage ?? form.welcomeScreen?.headerImage ?? '';
  const headerImageLayout: HeaderImageLayout =
    existingStep?.headerImageLayout ?? form.welcomeScreen?.headerImageLayout ?? 'inline';
  const headerImageAlt = existingStep?.headerImageAlt ?? form.welcomeScreen?.headerImageAlt ?? '';
  const headerImageCaption =
    existingStep?.headerImageCaption ?? form.welcomeScreen?.headerImageCaption ?? '';
  const heroImagePrompt = existingStep?.heroImagePrompt ?? form.welcomeScreen?.heroImagePrompt ?? '';
  const heroImageStyle = existingStep?.heroImageStyle ?? form.welcomeScreen?.heroImageStyle ?? 'minimal_3d';

  // Local UI states
  const [descriptionViewMode, setDescriptionViewMode] = useState<'edit' | 'preview'>('edit');
  const [imageTab, setImageTab] = useState<'ai_generate' | 'curated_presets' | 'custom_url'>('ai_generate');
  const [aiPromptInput, setAiPromptInput] = useState<string>(
    heroImagePrompt || 'Minimalist 3D geometric abstract shapes in slate and warm terracotta with soft studio shadows'
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(heroImageStyle || 'minimal_3d');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<string | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [snippetDropdownOpen, setSnippetDropdownOpen] = useState(false);
  const [justAppliedNotification, setJustAppliedNotification] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Commit changes to both form.steps and form.welcomeScreen
  const commitUpdates = (updates: Partial<WelcomeScreenConfig> & { enabled?: boolean }) => {
    const updatedWelcomeConfig: WelcomeScreenConfig = {
      enabled: updates.enabled ?? isEnabled,
      title: updates.title ?? title,
      description: updates.description ?? description,
      buttonLabel: updates.buttonLabel ?? buttonLabel,
      timeEstimate: updates.timeEstimate ?? timeEstimate,
      tagline: updates.tagline ?? tagline,
      showKeyboardHint: updates.showKeyboardHint ?? showKeyboardHint,
      headerImage: updates.headerImage !== undefined ? updates.headerImage : headerImage,
      headerImageAlt: updates.headerImageAlt !== undefined ? updates.headerImageAlt : headerImageAlt,
      headerImageLayout: updates.headerImageLayout ?? headerImageLayout,
      headerImageCaption: updates.headerImageCaption !== undefined ? updates.headerImageCaption : headerImageCaption,
      heroImagePrompt: updates.heroImagePrompt !== undefined ? updates.heroImagePrompt : heroImagePrompt,
      heroImageStyle: updates.heroImageStyle ?? heroImageStyle,
      heroImageSource: updates.heroImageSource ?? form.welcomeScreen?.heroImageSource ?? 'ai_generated',
    };

    let updatedSteps = [...form.steps];

    if (updatedWelcomeConfig.enabled) {
      const stepData: FormStep = {
        id: existingStep?.id || 'step-welcome-' + Date.now(),
        type: 'welcome',
        title: updatedWelcomeConfig.title,
        description: updatedWelcomeConfig.description,
        buttonLabel: updatedWelcomeConfig.buttonLabel,
        timeEstimate: updatedWelcomeConfig.timeEstimate,
        tagline: updatedWelcomeConfig.tagline,
        showKeyboardHint: updatedWelcomeConfig.showKeyboardHint,
        headerImage: updatedWelcomeConfig.headerImage,
        headerImageAlt: updatedWelcomeConfig.headerImageAlt,
        headerImageLayout: updatedWelcomeConfig.headerImageLayout,
        headerImageCaption: updatedWelcomeConfig.headerImageCaption,
        heroImagePrompt: updatedWelcomeConfig.heroImagePrompt,
        heroImageStyle: updatedWelcomeConfig.heroImageStyle,
        heroImageSource: updatedWelcomeConfig.heroImageSource,
        validation: { required: false },
      };

      if (welcomeStepIndex !== -1) {
        updatedSteps[welcomeStepIndex] = stepData;
      } else {
        // Welcome step always belongs at the very beginning (index 0)
        updatedSteps = [stepData, ...updatedSteps];
      }
    } else {
      // Remove welcome step from steps array when disabled
      updatedSteps = updatedSteps.filter((s) => s.type !== 'welcome');
    }

    onUpdateForm({
      ...form,
      welcomeScreen: updatedWelcomeConfig,
      steps: updatedSteps,
      updatedAt: 'Just now',
    });
  };

  // Turn welcome screen on/off
  const handleToggleEnabled = (newEnabled: boolean) => {
    commitUpdates({ enabled: newEnabled });
    if (newEnabled && onPreviewWelcomeScreen) {
      setTimeout(() => onPreviewWelcomeScreen(), 100);
    }
  };

  // Rich Text Formatting helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentText = description;

    let selectedText = currentText.substring(start, end);
    if (!selectedText && defaultPlaceholder) {
      selectedText = defaultPlaceholder;
    }

    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextText = currentText.substring(0, start) + replacement + currentText.substring(end);

    commitUpdates({ description: nextText });

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 20);
  };

  // AI Copywriter Generation
  const handleGenerateAICopy = async () => {
    setIsGeneratingCopy(true);
    try {
      const { copy, source } = await generateAIWelcomeCopy({
        formTitle: form.title,
        formDescription: form.description,
      });

      commitUpdates({
        title: copy.title,
        description: copy.description,
        tagline: copy.tagline,
        timeEstimate: copy.timeEstimate,
        buttonLabel: copy.buttonLabel,
      });

      if (copy.suggestedHeroPrompt) {
        setAiPromptInput(copy.suggestedHeroPrompt);
      }

      // The AI service is a best-effort public endpoint — when it's
      // unavailable this silently used the curated template instead, so the
      // toast says so rather than claiming "AI" for content that wasn't.
      setJustAppliedNotification(
        source === 'ai' ? 'AI copy generated and applied!' : 'Copy generated and applied!',
      );
      setTimeout(() => setJustAppliedNotification(null), 3000);
    } catch {
      // Silent error handling
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // AI Hero Image Generation
  const handleGenerateAIImage = async () => {
    if (!aiPromptInput.trim()) return;

    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setImageGenerationStatus('Generating your image…');

    try {
      const result = await generateAIHeroImage({
        prompt: aiPromptInput.trim(),
        style: selectedStyle,
        aspectRatio,
        formTitle: form.title,
      });

      commitUpdates({
        headerImage: result.imageUrl,
        heroImagePrompt: aiPromptInput.trim(),
        heroImageStyle: selectedStyle,
        heroImageSource: result.source === 'ai' ? 'ai_generated' : 'preset',
        headerImageAlt: aiPromptInput.trim(),
      });

      // The image service is a best-effort public endpoint — when it's
      // unavailable this silently used a curated preset instead, so the
      // toast says so rather than claiming "AI" for an image that wasn't.
      setJustAppliedNotification(
        result.source === 'ai'
          ? 'AI Hero Image generated successfully!'
          : 'Image service unavailable — applied a curated preset instead.',
      );
      setTimeout(() => setJustAppliedNotification(null), 3000);
    } catch {
      setImageGenerationError('Could not generate an image right now. Please try again.');
    } finally {
      setIsGeneratingImage(false);
      setImageGenerationStatus(null);
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        commitUpdates({
          headerImage: dataUrl,
          heroImageSource: 'upload',
          headerImageAlt: file.name,
        });
        setJustAppliedNotification('Hero image uploaded successfully!');
        setTimeout(() => setJustAppliedNotification(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="welcome-screen-editor-container" className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight font-headline-sm">
                  Welcome Screen & Greeting
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">
                Set a high-impact first impression for respondents with a custom headline, rich-text
                briefing, and an optional AI-generated hero image.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
            {onPreviewWelcomeScreen && isEnabled && (
              <button
                type="button"
                id="btn-preview-welcome-screen"
                onClick={onPreviewWelcomeScreen}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                title="Preview welcome screen in interactive canvas"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview</span>
              </button>
            )}

            <button
              type="button"
              id="btn-toggle-welcome-screen"
              onClick={() => handleToggleEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={isEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Quick notification banner */}
        {justAppliedNotification && (
          <div className="mt-4 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{justAppliedNotification}</span>
          </div>
        )}
      </div>

      {/* Disabled State Placeholder */}
      {!isEnabled && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4 border border-slate-200/80">
            <Sparkles className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Welcome Screen is Disabled</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            Respondents currently jump straight into Question #1. Enabling the Welcome Screen lets
            you frame your questionnaire with an inspiring hero image, time estimate, and rich text
            overview.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              id="btn-enable-welcome-screen-cta"
              onClick={() => handleToggleEnabled(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>Enable Welcome Screen</span>
            </button>
            <button
              type="button"
              id="btn-enable-and-generate-ai"
              onClick={async () => {
                handleToggleEnabled(true);
                await handleGenerateAICopy();
              }}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Generate with AI Copywriter</span>
            </button>
          </div>
        </div>
      )}

      {/* When Enabled: Active Editor Sections */}
      {isEnabled && (
        <div className="space-y-6">
          {/* Section 1: Core Headline & Eyebrow Badge */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono-code">
                  Greeting & Headings
                </h3>
              </div>
              <button
                type="button"
                id="btn-ai-generate-copy-top"
                onClick={handleGenerateAICopy}
                disabled={isGeneratingCopy}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                <Wand2 className={`w-3.5 h-3.5 text-amber-600 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
                <span>{isGeneratingCopy ? 'Synthesizing...' : 'AI Auto-Generate Content'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tagline / Eyebrow Badge */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tagline / Eyebrow Badge
                </label>
                <input
                  type="text"
                  id="input-welcome-tagline"
                  value={tagline}
                  onChange={(e) => commitUpdates({ tagline: e.target.value })}
                  placeholder="e.g. ⚡ Quick Feedback, Product Beta 2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium outline-none transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">Small badge displayed above the title.</p>
              </div>

              {/* Time Estimate */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Estimated Time Badge
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    id="input-welcome-time-estimate"
                    value={timeEstimate}
                    onChange={(e) => commitUpdates({ timeEstimate: e.target.value })}
                    placeholder="e.g. Takes ~2 mins, 4 questions"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Sets clear respondent expectations.</p>
              </div>
            </div>

            {/* Title / Headline */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Welcome Title / Headline <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-welcome-title"
                value={title}
                onChange={(e) => commitUpdates({ title: e.target.value })}
                placeholder="e.g. We’d love your honest thoughts on our platform."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-sm font-semibold text-slate-900 outline-none transition"
              />
            </div>
          </div>

          {/* Section 2: Rich Text Description with Markdown Toolbar & Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono-code">
                  Rich Text Description
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Snippets Preset Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    id="btn-welcome-snippets-dropdown"
                    onClick={() => setSnippetDropdownOpen(!snippetDropdownOpen)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-slate-500" />
                    <span>Insert Template</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {snippetDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 animate-in fade-in zoom-in-95">
                      <div className="px-2 py-1 text-[10px] font-mono-code uppercase font-semibold text-slate-400">
                        Choose Description Preset
                      </div>
                      {RICH_TEXT_SNIPPETS.map((snippet) => (
                        <button
                          key={snippet.title}
                          type="button"
                          onClick={() => {
                            commitUpdates({ description: snippet.text });
                            setSnippetDropdownOpen(false);
                            setJustAppliedNotification(`Applied "${snippet.title}" preset`);
                            setTimeout(() => setJustAppliedNotification(null), 2500);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 transition cursor-pointer truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                        >
                          {snippet.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit vs Preview Segmented Toggle */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
                  <button
                    type="button"
                    id="tab-welcome-desc-edit"
                    onClick={() => setDescriptionViewMode('edit')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      descriptionViewMode === 'edit'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    id="tab-welcome-desc-preview"
                    onClick={() => setDescriptionViewMode('preview')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      descriptionViewMode === 'preview'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>

            {/* Rich Text Formatting Toolbar */}
            {descriptionViewMode === 'edit' && (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**', 'bold text')}
                  title="Bold (Ctrl+B)"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*', 'italic text')}
                  title="Italic (Ctrl+I)"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  type="button"
                  onClick={() => insertFormatting('\n- ', '', 'Bullet item')}
                  title="Bullet List"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n1. ', '', 'Numbered item')}
                  title="Numbered List"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n> ', '', 'Quote callout')}
                  title="Blockquote"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('`', '`', 'code')}
                  title="Inline Code / Badge"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('[', '](https://example.com)', 'Link label')}
                  title="Link"
                  className="p-1.5 rounded hover:bg-slate-200/70 text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <span className="text-[11px] text-slate-400 font-mono-code px-2">
                  Markdown enabled
                </span>
              </div>
            )}

            {/* Description Textarea or Rendered Preview */}
            {descriptionViewMode === 'edit' ? (
              <textarea
                ref={textareaRef}
                id="textarea-welcome-description"
                rows={5}
                value={description}
                onChange={(e) => commitUpdates({ description: e.target.value })}
                placeholder="Write a clear overview of your form, what to expect, or instructions..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs text-slate-800 leading-relaxed font-mono-code outline-none transition"
              />
            ) : (
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 min-h-[120px]">
                {description.trim() ? (
                  <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed space-y-2">
                    <Markdown>{description}</Markdown>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No description provided yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Call-to-Action & Button Settings */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ArrowRight className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono-code">
                Call-to-Action & Controls
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Button Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Button Call-to-Action Label
                </label>
                <input
                  type="text"
                  id="input-welcome-button-label"
                  value={buttonLabel}
                  onChange={(e) => commitUpdates({ buttonLabel: e.target.value })}
                  placeholder="e.g. Get Started, Begin Survey"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium outline-none transition"
                />
              </div>

              {/* Show Keyboard Hint Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Keyboard Shortcut Helper
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Display &quot;press Enter ↵&quot; hint beside button
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-toggle-keyboard-hint"
                  onClick={() => commitUpdates({ showKeyboardHint: !showKeyboardHint })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    showKeyboardHint ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      showKeyboardHint ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: AI Hero Image Generator & Layout */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono-code">
                    Optional Hero Image (AI Powered)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add visual impact with an AI-generated hero banner, illustration, or custom upload.
                  </p>
                </div>
              </div>

              {headerImage && (
                <button
                  type="button"
                  id="btn-remove-hero-image"
                  onClick={() =>
                    commitUpdates({
                      headerImage: '',
                      heroImagePrompt: '',
                      headerImageCaption: '',
                    })
                  }
                  className="px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer self-start sm:self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Image</span>
                </button>
              )}
            </div>

            {/* Layout Placement Selector (Banner, Inline, Split-Left, Split-Right) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Hero Image Layout Placement
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'banner' as HeaderImageLayout,
                    name: 'Wide Banner',
                    desc: 'Cinematic top banner',
                    icon: '▬',
                  },
                  {
                    id: 'inline' as HeaderImageLayout,
                    name: 'Centered Inline',
                    desc: 'Illustration above title',
                    icon: '▮',
                  },
                  {
                    id: 'split-left' as HeaderImageLayout,
                    name: 'Split Left',
                    desc: 'Hero on left column',
                    icon: '◧',
                  },
                  {
                    id: 'split-right' as HeaderImageLayout,
                    name: 'Split Right',
                    desc: 'Hero on right column',
                    icon: '◨',
                  },
                ].map((layoutOpt) => (
                  <button
                    key={layoutOpt.id}
                    type="button"
                    onClick={() => commitUpdates({ headerImageLayout: layoutOpt.id })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                      headerImageLayout === layoutOpt.id
                        ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-base mb-1 font-mono-code">{layoutOpt.icon}</div>
                    <div>
                      <div className="text-xs font-semibold">{layoutOpt.name}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          headerImageLayout === layoutOpt.id ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      >
                        {layoutOpt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Source Selector Tabs: AI Generator / Curated Presets / Custom URL */}
            <div className="pt-2">
              <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  id="tab-hero-ai-generator"
                  onClick={() => setImageTab('ai_generate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    imageTab === 'ai_generate'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Generate with AI</span>
                </button>
                <button
                  type="button"
                  id="tab-hero-curated-presets"
                  onClick={() => setImageTab('curated_presets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    imageTab === 'curated_presets'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Curated Gallery ({CURATED_AI_HERO_PRESETS.length})</span>
                </button>
                <button
                  type="button"
                  id="tab-hero-custom-url"
                  onClick={() => setImageTab('custom_url')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    imageTab === 'custom_url'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>URL or Upload</span>
                </button>
              </div>

              {/* Tab 1: AI Image Generator */}
              {imageTab === 'ai_generate' && (
                <div className="pt-4 space-y-4 animate-in fade-in">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Describe the Image to Generate
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono-code">
                        Prompt-to-Image
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={aiPromptInput}
                      onChange={(e) => setAiPromptInput(e.target.value)}
                      placeholder="e.g. Minimalist 3D geometric abstract shapes in slate and warm terracotta with soft shadows..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs text-slate-800 outline-none transition"
                    />

                    {/* Smart Prompt Suggestions */}
                    <div className="mt-2">
                      <div className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Suggested Prompts:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SMART_PROMPT_SUGGESTIONS.slice(0, 4).map((promptSug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAiPromptInput(promptSug)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-left transition cursor-pointer max-w-xs truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                            title={promptSug}
                          >
                            {promptSug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Style & Aspect Ratio Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Style selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Aesthetic Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {AI_HERO_STYLES.map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setSelectedStyle(style.id)}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                              selectedStyle === style.id
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="text-xs font-semibold leading-tight">{style.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aspect Ratio selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Image Aspect Ratio
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '16:9' as const, label: '16:9 Banner' },
                          { id: '4:3' as const, label: '4:3 Split' },
                          { id: '1:1' as const, label: '1:1 Square' },
                        ].map((ratio) => (
                          <button
                            key={ratio.id}
                            type="button"
                            onClick={() => setAspectRatio(ratio.id)}
                            className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                              aspectRatio === ratio.id
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {ratio.label}
                          </button>
                        ))}
                      </div>

                      {/* Primary Generate Button */}
                      <div className="mt-4">
                        <button
                          type="button"
                          id="btn-run-ai-hero-generation"
                          onClick={handleGenerateAIImage}
                          disabled={isGeneratingImage || !aiPromptInput.trim()}
                          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                        >
                          <Wand2 className={`w-4 h-4 text-amber-400 ${isGeneratingImage ? 'animate-spin' : ''}`} />
                          <span>
                            {isGeneratingImage
                              ? imageGenerationStatus || 'Generating with AI...'
                              : 'Generate AI Hero Image'}
                          </span>
                        </button>
                        {imageGenerationError && (
                          <p className="mt-2 text-xs font-medium text-rose-600">{imageGenerationError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Curated AI Hero Gallery */}
              {imageTab === 'curated_presets' && (
                <div className="pt-4 space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CURATED_AI_HERO_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => {
                          commitUpdates({
                            headerImage: preset.imageUrl,
                            heroImagePrompt: preset.prompt,
                            heroImageStyle: preset.style,
                            heroImageSource: 'preset',
                            headerImageAlt: preset.name,
                          });
                          setJustAppliedNotification(`Applied "${preset.name}"`);
                          setTimeout(() => setJustAppliedNotification(null), 2500);
                        }}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                          headerImage === preset.imageUrl
                            ? 'border-indigo-600 ring-2 ring-indigo-600/20 scale-[1.02] shadow-sm'
                            : 'border-slate-200 hover:border-slate-400 hover:shadow-2xs'
                        }`}
                      >
                        <div className="aspect-video bg-slate-100 overflow-hidden">
                          <img
                            src={preset.imageUrl}
                            alt={preset.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                        </div>
                        <div className="p-2 bg-white">
                          <div className="text-[11px] font-semibold text-slate-900 truncate">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {preset.category}
                          </div>
                        </div>
                        {headerImage === preset.imageUrl && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Custom URL or File Upload */}
              {imageTab === 'custom_url' && (
                <div className="pt-4 space-y-3 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Direct Image URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={headerImage.startsWith('data:') ? '' : headerImage}
                        onChange={(e) =>
                          commitUpdates({
                            headerImage: e.target.value,
                            heroImageSource: 'url',
                          })
                        }
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    >
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>Upload local image file (PNG, JPG, WebP)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Live Hero Image Preview Card */}
            {headerImage && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-700 font-mono-code uppercase">
                  Active Hero Image Preview
                </div>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-56">
                  <img
                    src={headerImage}
                    alt={headerImageAlt || title}
                    referrerPolicy="no-referrer"
                    className="w-full h-48 sm:h-56 object-cover"
                  />
                  {headerImageCaption && (
                    <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-lg bg-black/70 text-white text-[11px] backdrop-blur-xs font-mono-code truncate">
                      {headerImageCaption}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Image Caption (optional)
                    </label>
                    <input
                      type="text"
                      value={headerImageCaption}
                      onChange={(e) => commitUpdates({ headerImageCaption: e.target.value })}
                      placeholder="e.g. Annual Community Pulse 2026"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-600 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Alt Text (Accessibility)
                    </label>
                    <input
                      type="text"
                      value={headerImageAlt}
                      onChange={(e) => commitUpdates({ headerImageAlt: e.target.value })}
                      placeholder="e.g. Modern workspace with laptop and coffee"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-600 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
