import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from '../lib/markdown';
import { motion, AnimatePresence, useReducedMotion } from '../lib/motion';
import {
  ChevronUp,
  ChevronDown,
  Check,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Smartphone,
  Star,
  Send,
  Clock,
  GitBranch,
  ExternalLink,
  Heart,
  Rocket,
  ThumbsUp,
  Link2,
  Hash,
  Calendar,
  ToggleLeft,
  Upload,
  Globe,
  FileText,
  ShieldCheck,
  Lock,
  Mail,
  Search,
  X,
  Building,
} from 'lucide-react';
import type { FormConfig, FormStep, FormTheme, BackgroundPattern } from '../types';
import { FORM_THEMES } from '../data/defaultForms';
import { resolveFormThemeValues } from '../data/themePresets';
import { evaluateStepBranching } from '../utils/logicUtils';
import { validateFormStepValue } from '../utils/validationUtils';

interface FormRespondentProps {
  form: FormConfig;
  activeTheme?: FormTheme;
  initialStepIndex?: number;
  isEmbedded?: boolean;
  isMobilePreview?: boolean;
  onComplete?: (answers: Record<string, any>) => void;
  onStepChange?: (index: number) => void;
  onExitFullscreen?: () => void;
}

export const FormRespondent: React.FC<FormRespondentProps> = ({
  form,
  activeTheme,
  initialStepIndex = 0,
  isEmbedded = false,
  isMobilePreview = false,
  onComplete,
  onStepChange,
  onExitFullscreen,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [stepHistory, setStepHistory] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [hasCompleted, setHasCompleted] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  // Guards against duplicate submissions: a re-selection before the 280ms
  // auto-advance timer fires cancels the earlier one instead of both firing,
  // and hasCompletedRef (read synchronously, unlike state) stops any further
  // advance — including a stale timer that was already in flight — once the
  // form has actually completed.
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, []);

  // Sync if initialStepIndex changes externally (e.g. step selection in builder)
  useEffect(() => {
    if (initialStepIndex !== undefined && initialStepIndex >= 0) {
      setCurrentStepIndex(initialStepIndex);
    }
  }, [initialStepIndex]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FORM_THEMES (src/data/defaultForms.ts) is a non-empty static list, so
  // this fallback can never actually be undefined.
  const theme = activeTheme || FORM_THEMES.find((t) => t.id === form.themeId) || FORM_THEMES[0]!;
  const customPalette = form.customPalette;
  const isCustomPaletteActive = Boolean(customPalette?.enabled);

  const rawSteps = form.steps || [];
  const hasExplicitThankYou = rawSteps.some((s) => s.type === 'thank_you');
  const steps = hasExplicitThankYou
    ? rawSteps
    : [
        ...rawSteps,
        {
          id: 'step-virtual-thank-you',
          type: 'thank_you' as const,
          title: form.thankYou?.title || 'Thank you for your response!',
          description:
            form.thankYou?.message ||
            'Your answers have been recorded. We appreciate your feedback.',
          buttonLabel: form.thankYou?.buttonLabel || 'Submit Another Response',
          redirectUrl: form.thankYou?.redirectUrl || '',
          redirectButtonText: form.thankYou?.redirectButtonText || 'Continue to Website',
          autoRedirect: form.thankYou?.autoRedirect || false,
          autoRedirectDelay: form.thankYou?.autoRedirectDelay || 5,
          showRestartButton: form.thankYou?.showRestartButton ?? true,
          badgeIcon: form.thankYou?.badgeIcon || 'check',
        },
      ];
  const currentStep: FormStep | undefined = steps[currentStepIndex] || steps[0];

  const totalSteps = steps.length;
  const nonWelcomeSteps = steps.filter((s) => s.type !== 'welcome' && s.type !== 'thank_you');
  const completedCount = nonWelcomeSteps.filter((s) => {
    const val = answers[s.id];
    return val !== undefined && val !== '' && (Array.isArray(val) ? val.length > 0 : true);
  }).length;
  const progressPercent = hasCompleted
    ? 100
    : nonWelcomeSteps.length > 0
      ? Math.round((completedCount / nonWelcomeSteps.length) * 100)
      : 0;

  const isLastQuestion =
    currentStepIndex >= steps.length - 2 || steps[currentStepIndex + 1]?.type === 'thank_you';

  // Thank You screen redirect configuration
  const currentRedirectUrl = currentStep?.redirectUrl || form.thankYou?.redirectUrl;
  const currentRedirectButtonText =
    currentStep?.redirectButtonText ||
    form.thankYou?.redirectButtonText ||
    'Continue to Website';
  const currentAutoRedirect =
    currentStep?.autoRedirect !== undefined
      ? currentStep.autoRedirect
      : form.thankYou?.autoRedirect ?? false;
  const currentAutoRedirectDelay =
    currentStep?.autoRedirectDelay || form.thankYou?.autoRedirectDelay || 5;
  const currentShowRestart =
    currentStep?.showRestartButton !== undefined
      ? currentStep.showRestartButton
      : form.thankYou?.showRestartButton ?? true;
  const currentBadgeIcon = currentStep?.badgeIcon || form.thankYou?.badgeIcon || 'check';

  // Opens currentRedirectUrl for real. window.open can be silently blocked
  // (returns null, doesn't throw) rather than failing loudly, so a falsy
  // result falls back to an in-tab navigation instead of leaving the
  // respondent stranded on the thank-you screen with no indication anything
  // went wrong.
  const handleRedirectClick = useCallback(() => {
    if (!currentRedirectUrl) return;
    const url = currentRedirectUrl.startsWith('http')
      ? currentRedirectUrl
      : `https://${currentRedirectUrl}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = url;
    }
  }, [currentRedirectUrl]);

  // Handle countdown timer when arriving at Thank You step with auto-redirect
  useEffect(() => {
    if (currentStep?.type === 'thank_you' && currentRedirectUrl && currentAutoRedirect) {
      setRedirectCountdown(currentAutoRedirectDelay);
      const timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            handleRedirectClick();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setRedirectCountdown(null);
    }
  }, [
    currentStepIndex,
    currentStep?.type,
    currentRedirectUrl,
    currentAutoRedirect,
    currentAutoRedirectDelay,
    handleRedirectClick,
  ]);

  // Notify parent on step change
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStepIndex);
    }
  }, [currentStepIndex, onStepChange]);

  // Focus active input when step changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  // Validation engine with all advanced patterns, length bounds & custom error messages
  const validateStep = (
    step: FormStep,
    value: any
  ): { isValid: boolean; message?: string } => {
    const result = validateFormStepValue(step, value);
    return {
      isValid: result.isValid,
      message: result.message,
    };
  };

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const advanceWithAnswer = (newAnswers: Record<string, any>, currentVal: any) => {
    if (!currentStep || hasCompletedRef.current) return;

    const validation = validateStep(currentStep, currentVal);
    if (!validation.isValid) {
      triggerError(validation.message || 'Please fulfill the question requirements.');
      return;
    }

    setErrorMessage(null);

    // Evaluate branching logic on current question
    const { targetStepId } = evaluateStepBranching(currentStep, currentVal);

    if (targetStepId) {
      const targetIndex = steps.findIndex((s) => s.id === targetStepId);
      if (targetIndex !== -1) {
        setStepHistory((prev) => [...prev, currentStepIndex]);
        setDirection(targetIndex >= currentStepIndex ? 'forward' : 'backward');
        setCurrentStepIndex(targetIndex);

        if (steps[targetIndex]?.type === 'thank_you') {
          hasCompletedRef.current = true;
          setHasCompleted(true);
          if (onComplete) {
            onComplete(newAnswers);
          }
        }
        return;
      }
    }

    // Sequential progression. Completion is reached either by running past the
    // last step (the virtual/synthesized thank-you case, where thank_you isn't
    // a real array element) or by landing on an explicit thank_you step that's
    // simply next in line rather than reached via a branching jump.
    const nextIndex = currentStepIndex + 1;
    const landsOnThankYou = nextIndex >= steps.length || steps[nextIndex]?.type === 'thank_you';

    setStepHistory((prev) => [...prev, currentStepIndex]);
    setDirection('forward');
    setCurrentStepIndex(Math.min(nextIndex, steps.length - 1));

    if (landsOnThankYou) {
      hasCompletedRef.current = true;
      setHasCompleted(true);
      if (onComplete) {
        onComplete(newAnswers);
      }
    }
  };

  const handleNext = () => {
    if (!currentStep || hasCompletedRef.current) return;
    const currentVal = answers[currentStep.id];
    advanceWithAnswer(answers, currentVal);
  };

  const handlePrev = () => {
    if (stepHistory.length > 0) {
      const lastIndex = stepHistory[stepHistory.length - 1];
      if (lastIndex === undefined) return;
      setErrorMessage(null);
      setStepHistory((prev) => prev.slice(0, -1));
      setDirection('backward');
      setCurrentStepIndex(lastIndex);
    } else if (currentStepIndex > 0) {
      setErrorMessage(null);
      setDirection('backward');
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleAnswerChange = (val: any) => {
    if (!currentStep) return;
    const newAnswers = { ...answers, [currentStep.id]: val };
    setAnswers(newAnswers);

    if (errorMessage) {
      const validation = validateStep(currentStep, val);
      if (validation.isValid) {
        setErrorMessage(null);
      }
    }
  };

  const handleChoiceSelect = (optionId: string, label: string) => {
    if (!currentStep || hasCompletedRef.current) return;
    const newAnswers = { ...answers, [currentStep.id]: label };
    setAnswers(newAnswers);
    setErrorMessage(null);
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      advanceWithAnswer(newAnswers, label);
    }, 280);
  };

  const handleYesNoSelect = (val: string) => {
    if (!currentStep || hasCompletedRef.current) return;
    const newAnswers = { ...answers, [currentStep.id]: val };
    setAnswers(newAnswers);
    setErrorMessage(null);
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      advanceWithAnswer(newAnswers, val);
    }, 280);
  };

  const handleRatingSelect = (score: number) => {
    if (!currentStep || hasCompletedRef.current) return;
    const newAnswers = { ...answers, [currentStep.id]: score };
    setAnswers(newAnswers);
    setErrorMessage(null);
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      advanceWithAnswer(newAnswers, score);
    }, 280);
  };

  const handleRestart = () => {
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    hasCompletedRef.current = false;
    setAnswers({});
    setStepHistory([]);
    setCurrentStepIndex(0);
    setHasCompleted(false);
    setErrorMessage(null);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!form.allowKeyboardShortcuts || hasCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore OS key-repeat from a held key — without this, holding Enter
      // fires handleNext() many times a second.
      if (e.repeat) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      }

      // Choice hotkeys (A, B, C, D...)
      if (currentStep?.type === 'multiple_choice' && currentStep.options) {
        const pressedKey = e.key.toUpperCase();
        const matched = currentStep.options.find(
          (opt, idx) =>
            opt.keyHint === pressedKey || String.fromCharCode(65 + idx) === pressedKey
        );
        if (matched) {
          e.preventDefault();
          handleChoiceSelect(matched.id, matched.label);
        }
      }

      // Yes/No hotkeys (Y, N)
      if (currentStep?.type === 'yes_no') {
        const pressedKey = e.key.toUpperCase();
        if (pressedKey === 'Y') {
          e.preventDefault();
          handleYesNoSelect(currentStep.yesLabel || 'Yes');
        } else if (pressedKey === 'N') {
          e.preventDefault();
          handleYesNoSelect(currentStep.noLabel || 'No');
        }
      }

      // Rating score hotkeys (1-5 or 1-9)
      if (currentStep?.type === 'rating' || currentStep?.type === 'opinion_scale') {
        const num = parseInt(e.key, 10);
        const max = currentStep.ratingMax || currentStep.scaleMax || 5;
        if (!isNaN(num) && num >= 0 && num <= max) {
          e.preventDefault();
          handleRatingSelect(num);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!currentStep) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
        <p>No questions configured in this form yet.</p>
      </div>
    );
  }

  const currentAnswer = answers[currentStep.id] ?? '';

  // Background design resolution
  const bgDesign = form.backgroundDesign || {
    type: form.backgroundImage ? 'image' : 'solid',
    imageUrl: form.backgroundImage,
    imageOpacity: form.backgroundOpacity ?? 0.25,
    imageBlur: form.backgroundBlur ?? 'none',
    imageFit: form.backgroundFit ?? 'cover',
    pattern: 'dots',
    patternOpacity: 0.12,
    gradientPreset: 'linear-mesh',
    gradientDirection: 'to-br',
    ambientGlow: false,
  };

  const activeBgImage = currentStep.backgroundImage || bgDesign.imageUrl;
  const activeBgOpacity = currentStep.backgroundOpacity ?? bgDesign.imageOpacity ?? 0.25;
  const activeBgBlur = currentStep.backgroundBlur || bgDesign.imageBlur || 'none';
  const activeBgFit = bgDesign.imageFit || form.backgroundFit || 'cover';

  // Step header cover image layout
  const isSplitLayout = Boolean(
    currentStep.headerImage &&
      (currentStep.headerImageLayout === 'split-right' ||
        currentStep.headerImageLayout === 'split-left')
  );

  const renderHeaderImageCard = (isSplit = false) => {
    if (!currentStep.headerImage) return null;
    return (
      <div
        className={`rounded-2xl overflow-hidden border border-zinc-200/80 shadow-xs relative group bg-zinc-100/80 ${
          isSplit
            ? 'w-full h-64 sm:h-80 md:h-full md:min-h-[420px] flex items-center justify-center'
            : currentStep.headerImageLayout === 'banner'
            ? 'w-full h-44 sm:h-60 mb-6'
            : 'w-full max-w-lg mx-auto h-40 sm:h-52 mb-6'
        }`}
      >
        <img
          src={currentStep.headerImage}
          alt={currentStep.headerImageAlt || currentStep.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
        />
        {currentStep.headerImageCaption && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded bg-black/60 text-white text-[11px] backdrop-blur-xs font-mono-code truncate">
            {currentStep.headerImageCaption}
          </div>
        )}
      </div>
    );
  };

  const renderCelebrationIcon = () => {
    const iconMap = {
      check: <Check className="w-8 h-8 text-emerald-600 stroke-[2.5]" />,
      sparkles: <Sparkles className="w-8 h-8 text-amber-500" />,
      heart: <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />,
      rocket: <Rocket className="w-8 h-8 text-indigo-500" />,
      thumbs_up: <ThumbsUp className="w-8 h-8 text-blue-500" />,
    };
    return (
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xs">
        {iconMap[currentBadgeIcon] || iconMap.check}
      </div>
    );
  };

  // Render SVG Pattern Background
  const renderSvgPattern = (pattern: BackgroundPattern, opacity: number) => {
    const strokeColor = customPalette?.enabled && customPalette.textColorHex
      ? customPalette.textColorHex
      : theme.id === 'minimal-obsidian'
      ? '#FFFFFF'
      : '#000000';

    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{ opacity }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {pattern === 'dots' && (
            <pattern id="resp-pattern-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.5" fill={strokeColor} />
            </pattern>
          )}
          {pattern === 'grid' && (
            <pattern id="resp-pattern-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke={strokeColor} strokeWidth="1" />
            </pattern>
          )}
          {pattern === 'blueprint' && (
            <pattern id="resp-pattern-blueprint" width="36" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            </pattern>
          )}
          {pattern === 'crosses' && (
            <pattern id="resp-pattern-crosses" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 14 9 L 14 19 M 9 14 L 19 14" stroke={strokeColor} strokeWidth="1.2" />
            </pattern>
          )}
          {pattern === 'diagonal-stripes' && (
            <pattern id="resp-pattern-stripes" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 20 L 20 0 M -5 5 L 5 -5 M 15 25 L 25 15" stroke={strokeColor} strokeWidth="1" />
            </pattern>
          )}
          {pattern === 'isometric' && (
            <pattern id="resp-pattern-iso" width="36" height="62.35" patternUnits="userSpaceOnUse">
              <path
                d="M 18 0 L 36 10.39 L 36 31.18 L 18 41.57 L 0 31.18 L 0 10.39 Z M 18 0 L 18 20.78 M 0 10.39 L 18 20.78 L 36 10.39"
                fill="none"
                stroke={strokeColor}
                strokeWidth="0.8"
              />
            </pattern>
          )}
          {pattern === 'waves' && (
            <pattern id="resp-pattern-waves" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 10 Q 10 0 20 10 T 40 10" fill="none" stroke={strokeColor} strokeWidth="1" />
            </pattern>
          )}
          {pattern === 'subtle-noise' && (
            <pattern id="resp-pattern-noise" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="1" fill={strokeColor} />
              <circle cx="12" cy="12" r="1" fill={strokeColor} />
              <circle cx="12" cy="4" r="0.6" fill={strokeColor} />
              <circle cx="4" cy="12" r="0.6" fill={strokeColor} />
            </pattern>
          )}
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#resp-pattern-${
            pattern === 'blueprint'
              ? 'blueprint'
              : pattern === 'crosses'
              ? 'crosses'
              : pattern === 'diagonal-stripes'
              ? 'stripes'
              : pattern === 'isometric'
              ? 'iso'
              : pattern === 'waves'
              ? 'waves'
              : pattern === 'subtle-noise'
              ? 'noise'
              : pattern === 'grid'
              ? 'grid'
              : 'dots'
          })`}
        />
      </svg>
    );
  };

  // Gradient preset styles
  const getGradientStyle = () => {
    const preset = bgDesign.gradientPreset || 'linear-mesh';
    const dir = bgDesign.gradientDirection || 'to-br';
    const dirCss =
      dir === 'to-b'
        ? 'to bottom'
        : dir === 'to-r'
        ? 'to right'
        : dir === 'radial'
        ? 'circle at center'
        : 'to bottom right';

    if (preset === 'sunset-glow') {
      return { background: `linear-gradient(${dirCss}, #f97316 0%, #ec4899 50%, #8b5cf6 100%)` };
    }
    if (preset === 'aurora-borealis') {
      return { background: `linear-gradient(${dirCss}, #059669 0%, #0d9488 40%, #0284c7 100%)` };
    }
    if (preset === 'soft-pastel') {
      return { background: `linear-gradient(${dirCss}, #e0e7ff 0%, #fce7f3 50%, #fef3c7 100%)` };
    }
    if (preset === 'midnight-nebula') {
      return { background: `linear-gradient(${dirCss}, #090d16 0%, #1e1b4b 50%, #312e81 100%)` };
    }
    if (preset === 'cyber-violet') {
      return { background: `linear-gradient(${dirCss}, #581c87 0%, #7e22ce 40%, #c026d3 100%)` };
    }
    if (preset === 'mint-fresh') {
      return { background: `linear-gradient(${dirCss}, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)` };
    }
    if (preset === 'warm-sunrise') {
      return { background: `linear-gradient(${dirCss}, #fffbeb 0%, #fef3c7 50%, #fed7aa 100%)` };
    }
    if (preset === 'ocean-depth') {
      return { background: `linear-gradient(${dirCss}, #0c4a6e 0%, #075985 40%, #0284c7 100%)` };
    }
    if (preset === 'desert-sand') {
      return { background: `linear-gradient(${dirCss}, #fafaf9 0%, #f5f5f4 50%, #e7e5e4 100%)` };
    }
    // linear-mesh default
    return {
      background: `radial-gradient(${dirCss}, rgba(99,102,241,0.15) 0%, transparent 70%), linear-gradient(${dirCss}, #f8fafc 0%, #e2e8f0 100%)`,
    };
  };

  // Primary accent button, font family, and border radius styling
  const resolvedTheme = resolveFormThemeValues(form);
  const customPrimaryHex =
    form.primaryColor ||
    (customPalette?.enabled ? customPalette.primaryColorHex : undefined) ||
    theme.primaryColorHex;
  const customBgHex = customPalette?.enabled
    ? customPalette.backgroundColorHex
    : undefined;
  const customTextHex = customPalette?.enabled ? customPalette.textColorHex : undefined;
  const customCardBg = customPalette?.enabled ? customPalette.cardBgColorHex : undefined;
  const customRoundingClass =
    form.borderRadius ||
    (customPalette?.enabled ? customPalette.borderRadius : undefined) ||
    resolvedTheme.borderRadiusClass ||
    'rounded-xl';
  const customFontCss = resolvedTheme.fontCss;

  const footerConfig = form.footer || {
    enabled: true,
    copyrightText: '© ' + new Date().getFullYear() + ' ' + (form.header?.brandName || form.title || 'Company Inc.'),
    showPoweredBy: true,
    privacyPolicyUrl: '#privacy',
    privacyPolicyLabel: 'Privacy Policy',
    termsUrl: '#terms',
    termsLabel: 'Terms of Service',
    supportEmail: '',
    supportLabel: 'Need Help?',
    securityBadge: true,
    alignment: 'between',
  };

  return (
    <div
      id="qub-form-respondent"
      className={`relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${
        isCustomPaletteActive ? '' : theme.bgClass
      } ${isCustomPaletteActive ? '' : theme.textClass} ${
        isEmbedded
          ? 'w-full h-full min-h-[500px] rounded-2xl border ' + theme.borderClass
          : isMobilePreview
          ? 'w-full h-full'
          : 'w-full min-h-screen'
      }`}
      style={{
        backgroundColor: customBgHex,
        color: customTextHex,
        fontFamily: customFontCss,
      }}
    >
      {/* BACKGROUND LAYER 1: Gradient Mesh */}
      {bgDesign.type === 'gradient' && (
        <div
          className="absolute inset-0 z-0 pointer-events-none select-none transition-all duration-700"
          style={getGradientStyle()}
        />
      )}

      {/* BACKGROUND LAYER 2: Geometric Pattern */}
      {bgDesign.type === 'pattern' &&
        renderSvgPattern(bgDesign.pattern || 'dots', bgDesign.patternOpacity ?? 0.12)}

      {/* BACKGROUND LAYER 3: Ambient Glow Aura */}
      {bgDesign.ambientGlow && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none select-none opacity-40"
          style={{
            backgroundColor: customPrimaryHex || '#6366F1',
          }}
        />
      )}

      {/* BACKGROUND LAYER 4: Wallpaper Image */}
      {bgDesign.type === 'image' && activeBgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <img
            src={activeBgImage}
            alt=""
            className={`w-full h-full ${
              activeBgFit === 'contain'
                ? 'object-contain'
                : activeBgFit === 'tile'
                ? 'object-repeat'
                : 'object-cover'
            } ${
              activeBgBlur === 'sm'
                ? 'blur-[2px]'
                : activeBgBlur === 'md'
                ? 'blur-[6px]'
                : activeBgBlur === 'lg'
                ? 'blur-[12px]'
                : ''
            } transition-all duration-700 scale-105`}
            style={{ opacity: activeBgOpacity }}
          />
          {/* Adaptive Contrast Overlay */}
          <div
            className={`absolute inset-0 transition-colors duration-300 ${
              theme.id === 'minimal-obsidian'
                ? 'bg-black/55 backdrop-blur-[0.5px]'
                : 'bg-white/45 backdrop-blur-[0.5px]'
            }`}
          />
        </div>
      )}

      {/* TOP BRAND HEADER BANNER (if configured) */}
      {form.header?.showHeaderBanner && form.header?.headerBannerUrl && (
        <div
          className="w-full relative z-20 overflow-hidden border-b border-zinc-200/40 shrink-0"
          style={{ height: `${form.header?.headerBannerHeight || 120}px` }}
        >
          <img
            src={form.header.headerBannerUrl}
            alt="Form Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
        </div>
      )}

      {/* TOP BRAND HEADER BAR */}
      <header
        id="form-brand-header"
        className="relative z-30 border-b border-zinc-200/50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md shrink-0"
      >
        {/* Progress Bar Strip */}
        {form.showProgressBar && (
          <div
            role="progressbar"
            aria-label="Form completion progress"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-1 bg-zinc-200/50"
          >
            <motion.div
              className="h-full"
              style={{
                backgroundColor: customPrimaryHex,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-3 select-none">
          {/* Brand Logo, Name & Tagline */}
          <div
            className={`flex items-center gap-3 truncate ${
              form.header?.logoAlignment === 'center'
                ? 'mx-auto'
                : form.header?.logoAlignment === 'right'
                ? 'ml-auto'
                : ''
            }`}
          >
            {form.header?.showLogo !== false && form.header?.logoUrl ? (
              <img
                src={form.header.logoUrl}
                alt={form.header.brandName || form.title}
                style={{ height: `${form.header.logoHeight || 30}px` }}
                className="object-contain shrink-0 max-w-[140px] rounded"
              />
            ) : form.header?.brandName ? (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: customPrimaryHex }}
              >
                {form.header.brandName.charAt(0).toUpperCase()}
              </div>
            ) : (
              <span
                className="w-2 h-2 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: customPrimaryHex }}
              />
            )}

            <div className="truncate text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {form.header?.brandName || form.title}
                </span>
                {form.header?.brandName && (
                  <span className="text-[11px] text-zinc-500 hidden sm:inline truncate">
                    · {form.title}
                  </span>
                )}
              </div>
              {form.header?.brandTagline && (
                <div className="text-[10px] text-zinc-500 truncate leading-tight">
                  {form.header.brandTagline}
                </div>
              )}
            </div>
          </div>

          {/* Header Right Actions (Website link + Progress + Exit) */}
          <div className="flex items-center gap-3 shrink-0 text-xs">
            {form.header?.websiteUrl && (
              <a
                href={
                  form.header.websiteUrl.startsWith('http')
                    ? form.header.websiteUrl
                    : `https://${form.header.websiteUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition"
              >
                <span>{form.header.websiteLabel || 'Visit website'}</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            )}

            {form.showProgressBar && progressPercent > 0 && (
              <span className="text-[11px] font-mono-code text-zinc-500 font-medium">
                {progressPercent}%
              </span>
            )}

            {onExitFullscreen && (
              <button
                onClick={onExitFullscreen}
                className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition font-mono-code text-xs cursor-pointer"
              >
                ESC
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CENTER QUESTION CANVAS */}
      <main
        className={`flex-1 flex flex-col items-center justify-center px-6 sm:px-12 md:px-20 py-10 mx-auto w-full relative z-10 transition-all ${
          isSplitLayout ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep.id}
            custom={direction}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: direction === 'forward' ? 30 : -30, filter: 'blur(3px)' }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: 'blur(0px)' }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: direction === 'forward' ? -30 : 30, filter: 'blur(3px)' }
            }
            transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full flex flex-col ${
              isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
            }`}
          >
            {/* Step Header Image (Banner Layout) */}
            {currentStep.headerImage &&
              currentStep.headerImageLayout === 'banner' &&
              renderHeaderImageCard(false)}

            {/* Step Header Image (Inline Layout - Default) */}
            {currentStep.headerImage &&
              (!currentStep.headerImageLayout ||
                currentStep.headerImageLayout === 'inline') &&
              renderHeaderImageCard(false)}

            <div
              className={`w-full ${
                isSplitLayout
                  ? 'grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center'
                  : 'flex flex-col'
              }`}
            >
              {isSplitLayout && currentStep.headerImageLayout === 'split-left' && (
                <div className="md:col-span-5 order-1 w-full">
                  {renderHeaderImageCard(true)}
                </div>
              )}

              <div
                className={`${
                  isSplitLayout ? 'md:col-span-7 order-2' : 'w-full'
                } flex flex-col`}
              >
                {/* Step Number Tracker */}
                {form.showQuestionNumbers &&
                  currentStep.type !== 'welcome' &&
                  currentStep.type !== 'thank_you' && (
                    <div className="flex items-center gap-2 mb-3 text-xs font-mono-code font-semibold tracking-wider text-zinc-500">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {String(currentStepIndex).padStart(2, '0')}
                      </span>
                      <span>/</span>
                      <span>{String(totalSteps - 1).padStart(2, '0')}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1 text-zinc-500 inline" />
                    </div>
                  )}

                {/* Welcome Screen Meta Badges */}
                {currentStep.type === 'welcome' &&
                  (currentStep.timeEstimate || currentStep.tagline) && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {currentStep.tagline && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-900/5 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60">
                          {currentStep.tagline}
                        </span>
                      )}
                      {currentStep.timeEstimate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-zinc-500 font-medium bg-zinc-100/80">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{currentStep.timeEstimate}</span>
                        </span>
                      )}
                    </div>
                  )}

                {/* Thank You Celebration Icon Badge */}
                {currentStep.type === 'thank_you' && (
                  <div className="flex justify-center mb-4">{renderCelebrationIcon()}</div>
                )}

                {/* Question Title */}
                <h1
                  id={`step-title-${currentStep.id}`}
                  className={`font-semibold tracking-tight leading-tight ${
                    currentStep.type === 'welcome'
                      ? 'text-3xl sm:text-4xl md:text-5xl mb-4 font-bold'
                      : currentStep.type === 'thank_you'
                      ? 'text-3xl sm:text-4xl md:text-5xl mb-3 text-center font-bold'
                      : 'text-2xl sm:text-3xl md:text-4xl mb-2.5'
                  }`}
                >
                  {currentStep.title}
                  {currentStep.validation?.required &&
                    currentStep.type !== 'welcome' &&
                    currentStep.type !== 'thank_you' && (
                      <span className="text-rose-600 ml-1.5 text-lg" title="Required">
                        *
                      </span>
                    )}
                </h1>

                {/* Question Description / Helper */}
                {currentStep.description && (
                  currentStep.type === 'welcome' ? (
                    <div
                      className={`text-sm sm:text-base mb-6 leading-relaxed ${theme.mutedClass} prose prose-sm max-w-none [&_strong]:text-inherit [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:text-zinc-800 [&_code]:font-mono-code [&_code]:text-xs [&_a]:underline [&_a]:underline-offset-2`}
                    >
                      <Markdown>{currentStep.description}</Markdown>
                    </div>
                  ) : (
                    <p
                      className={`text-sm sm:text-base mb-6 leading-relaxed ${
                        theme.mutedClass
                      } ${
                        currentStep.type === 'thank_you' ? 'text-center max-w-lg mx-auto' : ''
                      }`}
                    >
                      {currentStep.description}
                    </p>
                  )
                )}

                {/* QUESTION INPUTS ENGINE */}
                <div className="w-full mt-2">
                  {/* 1. WELCOME SCREEN */}
                  {currentStep.type === 'welcome' && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                      <button
                        id="btn-start-form"
                        onClick={handleNext}
                        style={{
                          backgroundColor: customPrimaryHex,
                          color: '#FFFFFF',
                        }}
                        className={`group px-8 py-3.5 ${customRoundingClass} font-medium text-base inline-flex items-center gap-3 transition-all shadow-sm active:scale-95 cursor-pointer`}
                      >
                        <span>{currentStep.buttonLabel || 'Get Started'}</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </button>
                      {currentStep.showKeyboardHint !== false && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono-code">
                          <span>press</span>
                          <kbd className="px-2 py-0.5 rounded bg-zinc-200/80 text-zinc-700 font-semibold border border-zinc-300/80">
                            Enter ↵
                          </kbd>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. SHORT TEXT INPUT */}
                  {currentStep.type === 'short_text' && (
                    <div className="w-full">
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        aria-labelledby={`step-title-${currentStep.id}`}
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                        maxLength={currentStep.validation?.maxLength}
                        value={currentAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder={currentStep.placeholder || 'Type your answer here...'}
                        className="w-full bg-transparent border-b-2 border-zinc-300 focus:border-zinc-900 pb-3 pt-2 text-xl sm:text-2xl font-normal outline-none transition-colors placeholder:text-zinc-300"
                      />
                      {/* Validation helper & live character count */}
                      {(currentStep.validation?.showCharCount ||
                        currentStep.validation?.minLength ||
                        currentStep.validation?.maxLength ||
                        currentStep.validation?.patternDescription) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 mt-2 font-mono-code">
                          <div>
                            {currentStep.validation?.patternDescription && (
                              <span className="text-zinc-500">
                                Format: {currentStep.validation.patternDescription}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 ml-auto">
                            {Boolean(currentStep.validation?.minLength) && (
                              <span
                                className={
                                  (typeof currentAnswer === 'string' ? currentAnswer.trim().length : 0) <
                                  (currentStep.validation?.minLength || 0)
                                    ? 'text-amber-700'
                                    : 'text-emerald-600'
                                }
                              >
                                Min {currentStep.validation?.minLength} chars
                              </span>
                            )}
                            {(currentStep.validation?.showCharCount || currentStep.validation?.maxLength) && (
                              <span>
                                {typeof currentAnswer === 'string' ? currentAnswer.length : 0}
                                {currentStep.validation?.maxLength ? ` / ${currentStep.validation.maxLength}` : ' chars'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. EMAIL INPUT */}
                  {currentStep.type === 'email' && (
                    <div className="w-full">
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="email"
                        autoComplete="email"
                        aria-labelledby={`step-title-${currentStep.id}`}
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                        maxLength={currentStep.validation?.maxLength}
                        value={currentAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder={currentStep.placeholder || 'name@company.com'}
                        className="w-full bg-transparent border-b-2 border-zinc-300 focus:border-zinc-900 pb-3 pt-2 text-xl sm:text-2xl font-normal outline-none transition-colors placeholder:text-zinc-300"
                      />
                      {currentStep.validation?.patternDescription && (
                        <div className="text-xs text-zinc-500 mt-1.5 font-mono-code">
                          Format: {currentStep.validation.patternDescription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. PHONE INPUT */}
                  {currentStep.type === 'phone' && (
                    <div className="w-full">
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="tel"
                        autoComplete="tel"
                        aria-labelledby={`step-title-${currentStep.id}`}
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                        maxLength={currentStep.validation?.maxLength}
                        value={currentAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder={currentStep.placeholder || '+1 (555) 000-0000'}
                        className="w-full bg-transparent border-b-2 border-zinc-300 focus:border-zinc-900 pb-3 pt-2 text-xl sm:text-2xl font-normal outline-none transition-colors placeholder:text-zinc-300 font-mono-code"
                      />
                      {currentStep.validation?.patternDescription && (
                        <div className="text-xs text-zinc-500 mt-1.5 font-mono-code">
                          Format: {currentStep.validation.patternDescription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. NUMBER INPUT (NEW) */}
                  {currentStep.type === 'number' && (
                    <div className="w-full">
                      <div className="flex items-center gap-3 max-w-md">
                        {currentStep.numberPrefix && (
                          <span className="text-2xl font-medium text-zinc-500">
                            {currentStep.numberPrefix}
                          </span>
                        )}
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="number"
                          aria-labelledby={`step-title-${currentStep.id}`}
                          aria-invalid={Boolean(errorMessage)}
                          aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                          min={currentStep.numberMin}
                          max={currentStep.numberMax}
                          step={currentStep.numberStep || 1}
                          value={currentAnswer}
                          onChange={(e) => handleAnswerChange(e.target.value)}
                          placeholder={currentStep.placeholder || '0'}
                          className="w-full bg-transparent border-b-2 border-zinc-300 focus:border-zinc-900 pb-2 pt-1 text-3xl font-semibold outline-none transition-colors"
                        />
                        {currentStep.numberSuffix && (
                          <span className="text-xl font-medium text-zinc-500">
                            {currentStep.numberSuffix}
                          </span>
                        )}
                      </div>
                      {(currentStep.numberMin !== undefined ||
                        currentStep.numberMax !== undefined) && (
                        <div className="text-xs text-zinc-500 mt-2 font-mono-code">
                          Limits: {currentStep.numberMin ?? '—'} to {currentStep.numberMax ?? '—'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. DATE PICKER (NEW) */}
                  {currentStep.type === 'date' && (
                    <div className="w-full max-w-md space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type="date"
                            aria-labelledby={`step-title-${currentStep.id}`}
                            aria-invalid={Boolean(errorMessage)}
                            aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                            min={currentStep.dateMin}
                            max={currentStep.dateMax}
                            value={currentAnswer}
                            onChange={(e) => handleAnswerChange(e.target.value)}
                            className="w-full bg-white/70 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-medium outline-none focus:border-zinc-900 shadow-2xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            handleAnswerChange(today);
                          }}
                          className="px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer shadow-2xs shrink-0"
                        >
                          Today
                        </button>
                      </div>
                      {currentAnswer && (
                        <div className="text-xs text-zinc-500 font-medium">
                          Selected: {new Date(currentAnswer).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 7. YES / NO TOGGLE (NEW) */}
                  {currentStep.type === 'yes_no' && (
                    <div className="grid grid-cols-2 gap-4 max-w-md w-full">
                      {[
                        { label: currentStep.yesLabel || 'Yes', keyHint: 'Y' },
                        { label: currentStep.noLabel || 'No', keyHint: 'N' },
                      ].map((btn) => {
                        const isSelected = currentAnswer === btn.label;
                        return (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => handleYesNoSelect(btn.label)}
                            className={`p-6 ${customRoundingClass} border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                              isSelected
                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                                : 'bg-white/80 hover:bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800 shadow-2xs'
                            }`}
                          >
                            <span className="text-xl font-bold">{btn.label}</span>
                            <span className="text-[11px] font-mono-code opacity-60">
                              Press {btn.keyHint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 8. DROPDOWN SELECT (NEW) */}
                  {currentStep.type === 'dropdown' && (
                    <div ref={dropdownRef} className="relative w-full max-w-md">
                      <button
                        type="button"
                        aria-labelledby={`step-title-${currentStep.id}`}
                        aria-haspopup="listbox"
                        aria-expanded={isDropdownOpen}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setIsDropdownOpen(false);
                        }}
                        className={`w-full p-3.5 ${customRoundingClass} border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-left flex items-center justify-between text-base font-medium transition cursor-pointer shadow-2xs`}
                      >
                        <span className={currentAnswer ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}>
                          {currentAnswer || currentStep.dropdownPlaceholder || 'Select an option...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      </button>

                      {isDropdownOpen && (
                        <div
                          role="listbox"
                          aria-label={currentStep.title}
                          className="absolute top-full left-0 right-0 mt-1.5 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto space-y-1"
                        >
                          <div className="relative mb-2">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              aria-label="Search choices"
                              value={dropdownSearch}
                              onChange={(e) => setDropdownSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setIsDropdownOpen(false);
                              }}
                              placeholder="Search choices..."
                              className="w-full text-xs pl-8 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-lg outline-none"
                            />
                          </div>

                          {(currentStep.options || [
                            { id: '1', label: 'Option A' },
                            { id: '2', label: 'Option B' },
                            { id: '3', label: 'Option C' },
                          ])
                            .filter((opt) =>
                              opt.label.toLowerCase().includes(dropdownSearch.toLowerCase())
                            )
                            .map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                role="option"
                                aria-selected={currentAnswer === opt.label}
                                onClick={() => {
                                  handleAnswerChange(opt.label);
                                  setIsDropdownOpen(false);
                                  setDropdownSearch('');
                                }}
                                className={`w-full p-2.5 rounded-lg text-left text-sm flex items-center justify-between transition cursor-pointer ${
                                  currentAnswer === opt.label
                                    ? 'bg-zinc-100 dark:bg-zinc-700 font-semibold text-zinc-900 dark:text-white'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200'
                                }`}
                              >
                                <span>{opt.label}</span>
                                {currentAnswer === opt.label && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 9. FILE UPLOAD (NEW) */}
                  {currentStep.type === 'file_upload' && (
                    <div className="w-full max-w-lg space-y-3">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-labelledby={`step-title-${currentStep.id}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(true);
                        }}
                        onDragLeave={() => setIsDraggingFile(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(false);
                          const files = e.dataTransfer.files;
                          if (files && files[0]) {
                            handleAnswerChange(files[0].name);
                          }
                        }}
                        onClick={() => {
                          const fileInput = document.getElementById('qub-file-picker');
                          fileInput?.click();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            document.getElementById('qub-file-picker')?.click();
                          }
                        }}
                        className={`p-8 border-2 border-dashed ${customRoundingClass} text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${
                          isDraggingFile
                            ? 'border-zinc-900 bg-zinc-100/80 dark:bg-zinc-800/80 scale-[1.01]'
                            : 'border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/40 hover:border-zinc-500'
                        }`}
                      >
                        <input
                          id="qub-file-picker"
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAnswerChange(e.target.files[0].name);
                            }
                          }}
                        />
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-2xs">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">
                            Drag and drop your file here, or browse
                          </span>
                          <span className="text-xs text-zinc-500 mt-1 block">
                            Supports PDF, DOCX, PNG, JPG (Max {currentStep.fileMaxSizeBytes ? Math.round(currentStep.fileMaxSizeBytes / 1024 / 1024) : 10} MB)
                          </span>
                        </div>
                      </div>

                      {/* File attachment preview pill */}
                      {currentAnswer && (
                        <div className="p-3 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-800 flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {currentAnswer}
                            </span>
                            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold shrink-0">
                              Ready
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAnswerChange('')}
                            className="p-1 rounded-md text-zinc-500 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 10. WEBSITE / URL INPUT (NEW) */}
                  {currentStep.type === 'website' && (
                    <div className="w-full max-w-lg space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-zinc-300 focus-within:border-zinc-900 pb-2">
                        <Globe className="w-5 h-5 text-zinc-500 shrink-0" />
                        <span className="text-lg font-mono-code text-zinc-500 font-normal select-none">
                          https://
                        </span>
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          aria-labelledby={`step-title-${currentStep.id}`}
                          aria-invalid={Boolean(errorMessage)}
                          aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                          value={currentAnswer.replace(/^https?:\/\//, '')}
                          onChange={(e) => {
                            const raw = e.target.value;
                            handleAnswerChange(raw ? `https://${raw.replace(/^https?:\/\//, '')}` : '');
                          }}
                          placeholder={currentStep.placeholder || 'example.com'}
                          className="flex-1 bg-transparent text-xl sm:text-2xl font-normal outline-none placeholder:text-zinc-300"
                        />
                      </div>
                      {currentAnswer && (
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Target: {currentAnswer}</span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                window.open(currentAnswer, '_blank', 'noopener,noreferrer');
                              } catch {
                                // fallback
                              }
                            }}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Test link</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 11. LONG TEXT / TEXTAREA */}
                  {currentStep.type === 'long_text' && (
                    <div className="w-full">
                      <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        rows={4}
                        aria-labelledby={`step-title-${currentStep.id}`}
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={errorMessage ? `step-error-${currentStep.id}` : undefined}
                        maxLength={currentStep.validation?.maxLength}
                        value={currentAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder={currentStep.placeholder || 'Share your detailed thoughts...'}
                        className="w-full bg-white/50 dark:bg-zinc-800/40 border border-zinc-300 dark:border-zinc-700 rounded-xl p-4 text-lg font-normal outline-none focus:border-zinc-900 dark:focus:border-white transition resize-none placeholder:text-zinc-400"
                      />
                      <div className="flex justify-between items-center text-xs text-zinc-500 mt-2 font-mono-code">
                        <span>Shift + Enter for new line</span>
                        <div className="flex items-center gap-3">
                          {Boolean(currentStep.validation?.minLength) && (
                            <span
                              className={
                                (typeof currentAnswer === 'string' ? currentAnswer.trim().length : 0) <
                                (currentStep.validation?.minLength || 0)
                                  ? 'text-amber-700'
                                  : 'text-emerald-600'
                              }
                            >
                              Min {currentStep.validation?.minLength} chars
                            </span>
                          )}
                          <span>
                            {typeof currentAnswer === 'string' ? currentAnswer.length : 0}
                            {currentStep.validation?.maxLength ? ` / ${currentStep.validation.maxLength}` : ' chars'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 12. MULTIPLE CHOICE */}
                  {currentStep.type === 'multiple_choice' && currentStep.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      {currentStep.options.map((option, idx) => {
                        const keyChar = option.keyHint || String.fromCharCode(65 + idx);
                        const isSelected = currentAnswer === option.label;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleChoiceSelect(option.id, option.label)}
                            className={`group relative flex items-center justify-between p-4 ${customRoundingClass} border text-left transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? `${theme.accentBorderClass} bg-zinc-900/5 dark:bg-white/10 ring-2 ring-zinc-900/20`
                                : `border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 bg-white/80 dark:bg-zinc-900/60`
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-7 h-7 rounded-md font-mono-code text-xs font-semibold flex items-center justify-center border transition-colors ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                }`}
                              >
                                {keyChar}
                              </span>
                              <span className="text-base font-medium">{option.label}</span>
                            </div>

                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 13. RATING (STARS) */}
                  {currentStep.type === 'rating' && (
                    <div className="flex flex-col items-start gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        {Array.from(
                          { length: currentStep.ratingMax || 5 },
                          (_, i) => i + 1
                        ).map((num) => {
                          const isSelected = currentAnswer === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleRatingSelect(num)}
                              className={`w-14 h-14 sm:w-16 sm:h-16 ${customRoundingClass} border text-xl font-semibold flex flex-col items-center justify-center gap-1 transition-all transform active:scale-95 cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                                  : 'bg-white border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-800'
                              }`}
                            >
                              <span className="font-bold">{num}</span>
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  isSelected ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between w-full max-w-xs text-xs text-zinc-500 font-medium">
                        <span>1 = Disappointing</span>
                        <span>{currentStep.ratingMax || 5} = Outstanding</span>
                      </div>
                    </div>
                  )}

                  {/* 14. OPINION SCALE (0-10 NPS) */}
                  {currentStep.type === 'opinion_scale' && (
                    <div className="w-full">
                      <div className="grid grid-cols-5 sm:grid-cols-11 gap-1.5 sm:gap-2">
                        {Array.from(
                          { length: (currentStep.scaleMax || 10) + 1 },
                          (_, i) => i
                        ).map((score) => {
                          const isSelected = currentAnswer === score;
                          return (
                            <button
                              key={score}
                              type="button"
                              onClick={() => handleRatingSelect(score)}
                              className={`h-12 sm:h-14 rounded-lg border font-semibold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                                  : 'bg-white border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-800'
                              }`}
                            >
                              {score}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center text-xs text-zinc-500 mt-3 font-medium">
                        <span>{currentStep.scaleMinLabel || '0 = Not at all likely'}</span>
                        <span>{currentStep.scaleMaxLabel || '10 = Extremely likely'}</span>
                      </div>
                    </div>
                  )}

                  {/* 15. STATEMENT / INFORMATIONAL */}
                  {currentStep.type === 'statement' && (
                    <div className="flex items-center gap-4 pt-2">
                      <button
                        type="button"
                        onClick={handleNext}
                        style={{
                          backgroundColor: customPrimaryHex,
                          color: '#FFFFFF',
                        }}
                        className={`px-7 py-3 ${customRoundingClass} font-medium text-sm inline-flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer`}
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-zinc-500 font-mono-code">press Enter ↵</span>
                    </div>
                  )}

                  {/* 16. THANK YOU / CELEBRATION SCREEN */}
                  {currentStep.type === 'thank_you' && (
                    <div className="flex flex-col items-center justify-center text-center pt-2">
                      {currentRedirectUrl && currentAutoRedirect && redirectCountdown !== null && (
                        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                          <Clock
                            className="w-3.5 h-3.5 text-zinc-500 animate-spin"
                            style={{ animationDuration: '3s' }}
                          />
                          <span>
                            Redirecting in{' '}
                            <strong className="font-mono-code font-bold text-zinc-900 dark:text-white">
                              {redirectCountdown}s
                            </strong>
                            ...
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {currentRedirectUrl && (
                          <button
                            type="button"
                            id="btn-thank-you-redirect"
                            onClick={handleRedirectClick}
                            style={{
                              backgroundColor: customPrimaryHex,
                              color: '#FFFFFF',
                            }}
                            className={`group px-7 py-3.5 ${customRoundingClass} font-medium text-sm inline-flex items-center gap-2.5 shadow-sm transition-all active:scale-95 cursor-pointer`}
                          >
                            <span>{currentRedirectButtonText}</span>
                            <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        )}

                        {currentShowRestart && (
                          <button
                            type="button"
                            id="btn-thank-you-restart"
                            onClick={handleRestart}
                            className={`px-6 py-3.5 ${customRoundingClass} border border-zinc-300 hover:border-zinc-400 text-sm font-medium inline-flex items-center gap-2 transition active:scale-95 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 shadow-2xs cursor-pointer`}
                          >
                            <RotateCcw className="w-4 h-4 text-zinc-500" />
                            <span>
                              {currentStep.buttonLabel ||
                                form.thankYou?.buttonLabel ||
                                'Submit Another Response'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Real-Time Error Alert */}
                {errorMessage && (
                  <motion.div
                    id={`step-error-${currentStep.id}`}
                    role="alert"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex items-center gap-2 mt-4 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200/80 px-3.5 py-2 rounded-lg self-start"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}

                {/* OK / Confirm Next Step Action (for standard question screens) */}
                {currentStep.type !== 'welcome' &&
                  currentStep.type !== 'thank_you' &&
                  currentStep.type !== 'statement' && (
                    <div className="mt-8 flex items-center gap-3">
                      <button
                        id="btn-next-step"
                        type="button"
                        onClick={handleNext}
                        style={{
                          backgroundColor: customPrimaryHex,
                          color: '#FFFFFF',
                        }}
                        className={`group px-6 py-2.5 ${customRoundingClass} font-medium text-sm inline-flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer`}
                      >
                        <span>{isLastQuestion ? 'Submit' : 'OK'}</span>
                        {isLastQuestion ? (
                          <Send className="w-3.5 h-3.5" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>

                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 font-mono-code">
                        <span>press</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700 border border-zinc-300/80">
                          Enter ↵
                        </kbd>
                      </div>
                    </div>
                  )}
              </div>

              {isSplitLayout && currentStep.headerImageLayout === 'split-right' && (
                <div className="md:col-span-5 order-3 md:order-2 w-full">
                  {renderHeaderImageCard(true)}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* CUSTOMER FOOTER BAR */}
      {footerConfig.enabled !== false && (
        <footer
          id="form-customer-footer"
          className="relative z-20 px-6 py-3.5 border-t border-zinc-200/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md shrink-0 select-none text-xs text-zinc-500"
        >
          <div
            className={`flex flex-wrap items-center gap-3 ${
              footerConfig.alignment === 'center'
                ? 'justify-center text-center'
                : footerConfig.alignment === 'left'
                ? 'justify-start'
                : 'justify-between'
            }`}
          >
            {/* Left: Copyright & Legal */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-normal text-zinc-600 dark:text-zinc-500">
                {footerConfig.copyrightText ||
                  `© ${new Date().getFullYear()} ${form.header?.brandName || form.title}`}
              </span>

              {footerConfig.privacyPolicyLabel && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      footerConfig.privacyPolicyUrl &&
                      footerConfig.privacyPolicyUrl.startsWith('http')
                    ) {
                      window.open(footerConfig.privacyPolicyUrl, '_blank');
                    } else {
                      setActiveModal('privacy');
                    }
                  }}
                  className="hover:underline text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                >
                  {footerConfig.privacyPolicyLabel}
                </button>
              )}

              {footerConfig.termsLabel && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      footerConfig.termsUrl &&
                      footerConfig.termsUrl.startsWith('http')
                    ) {
                      window.open(footerConfig.termsUrl, '_blank');
                    } else {
                      setActiveModal('terms');
                    }
                  }}
                  className="hover:underline text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                >
                  {footerConfig.termsLabel}
                </button>
              )}

              {footerConfig.supportEmail && (
                <a
                  href={`mailto:${footerConfig.supportEmail}`}
                  className="hover:underline text-zinc-500 hover:text-zinc-800 inline-flex items-center gap-1 transition"
                >
                  <Mail className="w-3 h-3 text-zinc-500" />
                  <span>{footerConfig.supportLabel || 'Contact Support'}</span>
                </a>
              )}
            </div>

            {/* Right: Security Badge, Powered By & Navigation Chevrons */}
            <div className="flex items-center gap-3 ml-auto">
              {footerConfig.securityBadge !== false && (
                <div className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-bit Encrypted</span>
                </div>
              )}

              {footerConfig.showPoweredBy !== false && (
                <div className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-mono-code">
                  <span>Powered by</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">qub-forms</span>
                </div>
              )}

              {/* Chevrons Up/Down */}
              <div className="flex items-center gap-1 pl-1">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={handlePrev}
                  aria-label="Previous question"
                  className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentStepIndex >= steps.length - 1}
                  onClick={handleNext}
                  aria-label="Next question"
                  className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* PRIVACY POLICY & TERMS MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeModal === 'privacy' ? 'Privacy Notice' : 'Terms of Service'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2.5 leading-relaxed">
              {activeModal === 'privacy' ? (
                <>
                  <p>
                    <strong>Data Privacy Notice:</strong> This form collects responses strictly for{' '}
                    {form.header?.brandName || form.title || 'the form administrator'}. We respect
                    your privacy and adhere to data protection standards.
                  </p>
                  <p>
                    Information submitted through this form is encrypted in transit using 256-bit SSL
                    and is used solely for the intended research, feedback, or operational purposes.
                  </p>
                  <p>
                    You have the right to request deletion or modification of any personal responses
                    at any time by contacting{' '}
                    {footerConfig.supportEmail || 'the form administrator'}.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Terms of Service:</strong> By completing and submitting this form, you
                    confirm that the information provided is accurate to the best of your knowledge.
                  </p>
                  <p>
                    Submissions must not contain unlawful, harassing, or defamatory materials. The
                    form owner reserves the right to review and discard malicious or spam submissions.
                  </p>
                </>
              )}
            </div>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
