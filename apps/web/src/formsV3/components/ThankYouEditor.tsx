import React, { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Heart,
  Rocket,
  ThumbsUp,
  ExternalLink,
  Link2,
  RotateCcw,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  Compass,
} from 'lucide-react';
import type { FormConfig, FormStep, ThankYouConfig } from '../types';

interface ThankYouEditorProps {
  form: FormConfig;
  thankYouStep?: FormStep;
  onUpdateThankYou: (updates: {
    title: string;
    description: string;
    buttonLabel?: string;
    redirectUrl?: string;
    redirectButtonText?: string;
    autoRedirect?: boolean;
    autoRedirectDelay?: number;
    showRestartButton?: boolean;
    badgeIcon?: 'check' | 'sparkles' | 'heart' | 'rocket' | 'thumbs_up';
  }) => void;
  onAddThankYouStep?: () => void;
}

export const ThankYouEditor: React.FC<ThankYouEditorProps> = ({
  form,
  thankYouStep,
  onUpdateThankYou,
  onAddThankYouStep,
}) => {
  // Pull existing values from either the thankYouStep or form.thankYou fallback
  const title =
    thankYouStep?.title ??
    form.thankYou?.title ??
    'Thank you for your response!';

  const description =
    thankYouStep?.description ??
    form.thankYou?.message ??
    'Your answers have been recorded. We appreciate you taking the time to share your perspective.';

  const buttonLabel =
    thankYouStep?.buttonLabel ??
    form.thankYou?.buttonLabel ??
    'Submit Another Response';

  const redirectUrl =
    thankYouStep?.redirectUrl ??
    form.thankYou?.redirectUrl ??
    '';

  const redirectButtonText =
    thankYouStep?.redirectButtonText ??
    form.thankYou?.redirectButtonText ??
    'Continue to Website';

  const autoRedirect =
    thankYouStep?.autoRedirect ??
    form.thankYou?.autoRedirect ??
    false;

  const autoRedirectDelay =
    thankYouStep?.autoRedirectDelay ??
    form.thankYou?.autoRedirectDelay ??
    5;

  const showRestartButton =
    thankYouStep?.showRestartButton ??
    form.thankYou?.showRestartButton ??
    true;

  const badgeIcon =
    thankYouStep?.badgeIcon ??
    form.thankYou?.badgeIcon ??
    'check';

  const [isRedirectEnabled, setIsRedirectEnabled] = useState<boolean>(
    Boolean(redirectUrl && redirectUrl.trim().length > 0)
  );

  const [urlInputError, setUrlInputError] = useState<string | null>(null);

  const handleToggleRedirect = (enabled: boolean) => {
    setIsRedirectEnabled(enabled);
    if (!enabled) {
      onUpdateThankYou({
        title,
        description,
        buttonLabel,
        redirectUrl: '',
        redirectButtonText,
        autoRedirect: false,
        autoRedirectDelay,
        showRestartButton,
        badgeIcon,
      });
      setUrlInputError(null);
    } else {
      const defaultUrl = 'https://example.com';
      onUpdateThankYou({
        title,
        description,
        buttonLabel,
        redirectUrl: defaultUrl,
        redirectButtonText: redirectButtonText || 'Continue to Website',
        autoRedirect,
        autoRedirectDelay,
        showRestartButton,
        badgeIcon,
      });
    }
  };

  const handleUrlChange = (val: string) => {
    let cleanUrl = val.trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      // Don't show error immediately while user is typing, but flag if malformed
      if (cleanUrl.includes('.')) {
        setUrlInputError('Prefix will default to https:// if omitted');
      }
    } else {
      setUrlInputError(null);
    }

    onUpdateThankYou({
      title,
      description,
      buttonLabel,
      redirectUrl: val,
      redirectButtonText,
      autoRedirect,
      autoRedirectDelay,
      showRestartButton,
      badgeIcon,
    });
  };

  const handleUrlBlur = () => {
    let cleanUrl = redirectUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
      onUpdateThankYou({
        title,
        description,
        buttonLabel,
        redirectUrl: cleanUrl,
        redirectButtonText,
        autoRedirect,
        autoRedirectDelay,
        showRestartButton,
        badgeIcon,
      });
      setUrlInputError(null);
    }
  };

  const testRedirectUrl = () => {
    let target = redirectUrl.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const BADGE_ICONS: Array<{
    id: 'check' | 'sparkles' | 'heart' | 'rocket' | 'thumbs_up';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
  }> = [
    {
      id: 'check',
      label: 'Success Check',
      icon: CheckCircle2,
      bgClass: 'bg-emerald-50 border-emerald-200',
      textClass: 'text-emerald-600',
    },
    {
      id: 'sparkles',
      label: 'Celebration',
      icon: Sparkles,
      bgClass: 'bg-amber-50 border-amber-200',
      textClass: 'text-amber-600',
    },
    {
      id: 'heart',
      label: 'Gratitude',
      icon: Heart,
      bgClass: 'bg-rose-50 border-rose-200',
      textClass: 'text-rose-600',
    },
    {
      id: 'rocket',
      label: 'Fast Launch',
      icon: Rocket,
      bgClass: 'bg-indigo-50 border-indigo-200',
      textClass: 'text-indigo-600',
    },
    {
      id: 'thumbs_up',
      label: 'Appreciation',
      icon: ThumbsUp,
      bgClass: 'bg-sky-50 border-sky-200',
      textClass: 'text-sky-600',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 font-headline-sm">Post-Submission Experience</h3>
              <p className="text-[11px] text-slate-500">
                Customize what users see immediately after submitting
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code font-semibold bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Active
          </span>
        </div>

        {!thankYouStep && onAddThankYouStep && (
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
            <span>No explicit Thank You step in outline</span>
            <button
              type="button"
              onClick={onAddThankYouStep}
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add to Steps Outline</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: THANK YOU MESSAGE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono-code">
            1. Confirmation Message
          </label>
          <span className="text-[11px] text-slate-400">Displayed upon completion</span>
        </div>

        {/* Headline */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Thank You Headline
          </label>
          <input
            type="text"
            id="input-thank-you-title"
            value={title}
            onChange={(e) =>
              onUpdateThankYou({
                title: e.target.value,
                description,
                buttonLabel,
                redirectUrl,
                redirectButtonText,
                autoRedirect,
                autoRedirectDelay,
                showRestartButton,
                badgeIcon,
              })
            }
            className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:border-indigo-600 focus:outline-none transition font-semibold text-slate-900"
            placeholder="e.g. Thank you for your feedback!"
          />
        </div>

        {/* Description / Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Message Body / Follow-up Note
          </label>
          <textarea
            rows={3}
            id="input-thank-you-description"
            value={description}
            onChange={(e) =>
              onUpdateThankYou({
                title,
                description: e.target.value,
                buttonLabel,
                redirectUrl,
                redirectButtonText,
                autoRedirect,
                autoRedirectDelay,
                showRestartButton,
                badgeIcon,
              })
            }
            className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 focus:bg-white focus:border-indigo-600 focus:outline-none transition resize-none text-slate-700 leading-relaxed"
            placeholder="Explain next steps, when to expect a reply, or confirm response recording..."
          />
        </div>

        {/* Celebratory Badge Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Celebratory Icon Badge
          </label>
          <div className="grid grid-cols-5 gap-2">
            {BADGE_ICONS.map((item) => {
              const IconComp = item.icon;
              const isSelected = badgeIcon === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onUpdateThankYou({
                      title,
                      description,
                      buttonLabel,
                      redirectUrl,
                      redirectButtonText,
                      autoRedirect,
                      autoRedirectDelay,
                      showRestartButton,
                      badgeIcon: item.id,
                    })
                  }
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                    isSelected
                      ? `${item.bgClass} border-indigo-600 shadow-2xs scale-102`
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                  title={item.label}
                >
                  <IconComp className={`w-5 h-5 ${item.textClass}`} />
                  <span className="text-[10px] font-medium text-slate-600 truncate max-w-full">
                    {item.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: OPTIONAL REDIRECT LINK */}
      <div className="pt-3 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-slate-500" />
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono-code">
              2. Optional Redirect Link
            </label>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="toggle-enable-redirect"
              checked={isRedirectEnabled}
              onChange={(e) => handleToggleRedirect(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {!isRedirectEnabled ? (
          <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 text-xs text-slate-500 leading-relaxed">
            <p>
              Respondents will stay on the Thank You screen without a redirect. Enable this to guide
              users to your homepage, documentation, a Calendly scheduling link, or product dashboard.
            </p>
            <button
              type="button"
              onClick={() => handleToggleRedirect(true)}
              className="mt-2.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Link2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Enable Redirect Link</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-2xs animate-in fade-in duration-150">
            {/* Destination URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Destination URL</span>
                </label>
                {redirectUrl && (
                  <button
                    type="button"
                    onClick={testRedirectUrl}
                    className="text-[11px] font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                    title="Open destination in new tab"
                  >
                    <span>Test Link</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="url"
                  id="input-thank-you-redirect-url"
                  value={redirectUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={handleUrlBlur}
                  className="w-full text-xs font-mono-code border border-slate-200 rounded-lg p-2.5 pr-8 focus:border-indigo-600 focus:outline-none transition text-slate-900 bg-slate-50/50 focus:bg-white"
                  placeholder="https://yourwebsite.com/welcome"
                />
              </div>
              {urlInputError && (
                <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{urlInputError}</span>
                </p>
              )}
            </div>

            {/* Redirect CTA Button Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <span>Redirect Button Label</span>
              </label>
              <input
                type="text"
                id="input-thank-you-redirect-button"
                value={redirectButtonText}
                onChange={(e) =>
                  onUpdateThankYou({
                    title,
                    description,
                    buttonLabel,
                    redirectUrl,
                    redirectButtonText: e.target.value,
                    autoRedirect,
                    autoRedirectDelay,
                    showRestartButton,
                    badgeIcon,
                  })
                }
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:border-indigo-600 focus:outline-none transition text-slate-800"
                placeholder="e.g. Continue to Website or Book a Call"
              />
            </div>

            {/* Auto-Redirect Option */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">
                    Automatic Redirect Timer
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Navigate respondents automatically without requiring a click
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="toggle-auto-redirect"
                    checked={autoRedirect}
                    onChange={(e) =>
                      onUpdateThankYou({
                        title,
                        description,
                        buttonLabel,
                        redirectUrl,
                        redirectButtonText,
                        autoRedirect: e.target.checked,
                        autoRedirectDelay,
                        showRestartButton,
                        badgeIcon,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {autoRedirect && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Countdown Delay</span>
                    </span>
                    <span className="font-mono-code font-bold text-slate-900">
                      {autoRedirectDelay} seconds
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 5, 8, 10].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() =>
                          onUpdateThankYou({
                            title,
                            description,
                            buttonLabel,
                            redirectUrl,
                            redirectButtonText,
                            autoRedirect: true,
                            autoRedirectDelay: sec,
                            showRestartButton,
                            badgeIcon,
                          })
                        }
                        className={`py-1.5 text-xs font-semibold rounded border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                          autoRedirectDelay === sec
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight pt-1">
                    Respondents will see an active timer countdown with an option to click and jump
                    immediately.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: RE-SUBMISSION / RESTART SETTINGS */}
      <div className="pt-3 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">
              'Submit Another Response' Action
            </h4>
            <p className="text-[11px] text-slate-500">
              Provide a button to clear and re-take the form
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="toggle-show-restart"
              checked={showRestartButton}
              onChange={(e) =>
                onUpdateThankYou({
                  title,
                  description,
                  buttonLabel,
                  redirectUrl,
                  redirectButtonText,
                  autoRedirect,
                  autoRedirectDelay,
                  showRestartButton: e.target.checked,
                  badgeIcon,
                })
              }
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {showRestartButton && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Button Label</span>
            </label>
            <input
              type="text"
              id="input-thank-you-restart-label"
              value={buttonLabel}
              onChange={(e) =>
                onUpdateThankYou({
                  title,
                  description,
                  buttonLabel: e.target.value,
                  redirectUrl,
                  redirectButtonText,
                  autoRedirect,
                  autoRedirectDelay,
                  showRestartButton,
                  badgeIcon,
                })
              }
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:border-indigo-600 focus:outline-none transition text-slate-800"
              placeholder="e.g. Submit Another Response"
            />
          </div>
        )}
      </div>
    </div>
  );
};
