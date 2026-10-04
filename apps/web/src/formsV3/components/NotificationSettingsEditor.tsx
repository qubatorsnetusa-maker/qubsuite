import React, { useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Check,
  Info,
  ExternalLink,
} from 'lucide-react';
import type { FormConfig, EmailNotificationConfig } from '../types';

interface NotificationSettingsEditorProps {
  form: FormConfig;
  onUpdateNotifications: (notifications: EmailNotificationConfig) => void;
}

export const NotificationSettingsEditor: React.FC<NotificationSettingsEditorProps> = ({
  form,
  onUpdateNotifications,
}) => {
  const currentConfig: EmailNotificationConfig = form.notifications || {
    enabled: false,
    recipientEmail: '',
    sendSummaryOnSubmit: true,
    customSubject: `[New Response] ${form.title}`,
    sendAlertsFor: 'all',
  };

  const [emailInputError, setEmailInputError] = useState<string | null>(null);

  // Email regex validation for single or comma-separated emails
  const validateEmails = (val: string): boolean => {
    if (!val.trim()) return false;
    const emails = val.split(',').map((e) => e.trim());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every((e) => emailRegex.test(e));
  };

  const handleEmailChange = (val: string) => {
    const isValid = validateEmails(val);
    if (!val.trim()) {
      setEmailInputError('Please enter at least one recipient email address.');
    } else if (!isValid) {
      setEmailInputError('Please enter a valid email format (e.g. name@example.com).');
    } else {
      setEmailInputError(null);
    }

    onUpdateNotifications({
      ...currentConfig,
      recipientEmail: val,
    });
  };

  const handleToggleEnabled = (enabled: boolean) => {
    onUpdateNotifications({
      ...currentConfig,
      enabled,
    });
  };

  const isEmailValid = validateEmails(currentConfig.recipientEmail);

  return (
    <div id="notification-settings-panel" className="space-y-6">
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/20">
              <Mail className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-headline-sm text-sm font-bold text-slate-900">Email Response Notifications</h3>
              <p className="text-xs text-slate-500">
                Receive instant email summaries and alerts whenever a respondent completes your form.
              </p>
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            id="toggle-email-alerts"
            checked={currentConfig.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Delivery notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
        <p className="text-[11px] leading-relaxed">
          Notification emails are sent for real when a response comes in. If nothing arrives,
          check that an email provider (e.g. <code className="font-mono-code">RESEND_API_KEY</code>)
          is configured on the server — deliveries silently no-op without one, and the failure is
          logged server-side rather than shown here.
        </p>
      </div>

      {/* Main Form Fields */}
      <div className="space-y-4">
        {/* Recipient Email Address Input */}
        <div>
          <label
            htmlFor="notification-recipient-email"
            className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1.5"
          >
            <span>Recipient Email Address</span>
            <span className="text-rose-500">*</span>
          </label>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              id="notification-recipient-email"
              value={currentConfig.recipientEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="e.g. alerts@yourcompany.com, team@domain.com"
              className={`w-full pl-10 pr-24 py-2.5 bg-white border text-xs rounded-xl focus:outline-none transition ${
                emailInputError
                  ? 'border-rose-300 focus:border-rose-500 ring-2 ring-rose-100'
                  : currentConfig.enabled && isEmailValid
                  ? 'border-emerald-300 focus:border-emerald-600 ring-2 ring-emerald-100'
                  : 'border-slate-200/90 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15'
              }`}
            />

            {/* Status indicator inside input */}
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {isEmailValid ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <Check className="w-3 h-3" />
                  <span>Ready</span>
                </span>
              ) : currentConfig.recipientEmail ? (
                <span className="text-[11px] text-rose-500 font-medium">Invalid email</span>
              ) : null}
            </div>
          </div>

          {emailInputError ? (
            <p className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{emailInputError}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Separate multiple email addresses with commas to notify your whole team.
            </p>
          )}
        </div>

        {/* Custom Subject Line */}
        <div>
          <label
            htmlFor="notification-custom-subject"
            className="block text-xs font-semibold text-slate-800 mb-1.5"
          >
            Email Subject Line
          </label>
          <input
            type="text"
            id="notification-custom-subject"
            value={currentConfig.customSubject || `[New Response] ${form.title}`}
            onChange={(e) =>
              onUpdateNotifications({
                ...currentConfig,
                customSubject: e.target.value,
              })
            }
            placeholder={`[New Response] ${form.title}`}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200/90 text-xs rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none transition"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Supports variables: <code className="font-mono-code text-slate-600 bg-slate-100 px-1 py-0.5 rounded">{'{form_title}'}</code>, <code className="font-mono-code text-slate-600 bg-slate-100 px-1 py-0.5 rounded">{'{time}'}</code>
          </span>
        </div>

        {/* Checkbox Options */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              id="chk-send-summary"
              checked={currentConfig.sendSummaryOnSubmit !== false}
              onChange={(e) =>
                onUpdateNotifications({
                  ...currentConfig,
                  sendSummaryOnSubmit: e.target.checked,
                })
              }
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-2 focus:ring-indigo-600 mt-0.5 accent-indigo-600"
            />
            <div>
              <span className="text-xs font-semibold text-slate-900 block">
                Include Full Answer Summary
              </span>
              <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                Embed each question prompt alongside the respondent's exact answer directly in the email body.
              </span>
            </div>
          </label>

          <div className="pt-3 border-t border-slate-200/70">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Alert Trigger Condition
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Responses', desc: 'Every submission' },
                { id: 'high_scores', label: 'High Ratings', desc: '4-5 stars or promoters' },
                { id: 'low_scores', label: 'Low / Urgent', desc: '≤ 2 stars (needs triage)' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() =>
                    onUpdateNotifications({
                      ...currentConfig,
                      sendAlertsFor: filter.id as any,
                    })
                  }
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                    (currentConfig.sendAlertsFor || 'all') === filter.id
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{filter.label}</div>
                  <div
                    className={`text-[10px] ${
                      (currentConfig.sendAlertsFor || 'all') === filter.id
                        ? 'text-indigo-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {filter.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {currentConfig.enabled && isEmailValid && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Preferences saved
            </span>
          </div>
        )}
      </div>

      {/* Email Format Preview — a mockup of the layout for editing convenience;
          the real email is assembled server-side in server/email/notifications.ts,
          which may format the summary table slightly differently. */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono-code">
            Email Format Preview
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
          {/* Email Client Top Bar */}
          <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-2.5 text-xs flex flex-col gap-1 text-slate-600 font-mono-code">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400">From: </span>
                <span className="text-slate-800 font-semibold">qub-forms Alerts &lt;notifications@qubforms.app&gt;</span>
              </div>
              <span className="text-[10px] text-slate-400">Example</span>
            </div>
            <div>
              <span className="text-slate-400">To: </span>
              <span className="text-slate-900 font-semibold">
                {currentConfig.recipientEmail || 'your-email@example.com'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Subject: </span>
              <span className="text-slate-900 font-semibold">
                {currentConfig.customSubject || `[New Response] ${form.title}`}
              </span>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-5 space-y-4">
            {/* Brand Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center font-mono-code">
                  Q
                </div>
                <span className="text-xs font-bold text-slate-900 tracking-tight">qub-forms</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                New Submission Alert
              </span>
            </div>

            {/* Email Headline */}
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Someone just completed &ldquo;{form.title}&rdquo;
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Completed in ~45 seconds · {form.steps.length} questions answered
              </p>
            </div>

            {/* Answers Table */}
            {currentConfig.sendSummaryOnSubmit !== false ? (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100 text-xs">
                {form.steps
                  .filter((s) => s.type !== 'welcome' && s.type !== 'thank_you')
                  .slice(0, 4)
                  .map((step, idx) => (
                    <div key={step.id} className="p-3 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
                      <div className="text-slate-500 font-medium max-w-xs">
                        {idx + 1}. {step.title}
                      </div>
                      <div className="font-semibold text-slate-900 font-mono-code text-right">
                        {step.type === 'rating'
                          ? '★★★★★ (5/5)'
                          : step.type === 'multiple_choice'
                          ? step.options?.[0]?.label || 'Selected Option'
                          : step.type === 'email'
                          ? 'alex.smith@client.com'
                          : 'Satisfied customer feedback'}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 text-slate-500 text-xs italic text-center">
                Answer summary omitted (view responses directly in dashboard).
              </div>
            )}

            {/* Call to action in email */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Notification configured for: {currentConfig.recipientEmail || 'your-email@example.com'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline">
                <span>View in Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
