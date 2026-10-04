import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Share2,
  X,
  Mail,
  CheckCircle2,
  Sparkles,
  QrCode,
  Globe,
  Layers,
} from 'lucide-react';
import type { FormConfig } from '../types';
import { getSharableFormUrl, getEmbedCode, copyToClipboard } from '../utils/shareUtils';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ShareFormModalProps {
  form: FormConfig;
  isOpen: boolean;
  onClose: () => void;
  onOpenLiveDemo?: () => void;
}

export const ShareFormModal: React.FC<ShareFormModalProps> = ({
  form,
  isOpen,
  onClose,
  onOpenLiveDemo,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'embed' | 'invite'>('link');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const sharableUrl = getSharableFormUrl(form.id);
  const embedCode = getEmbedCode(form.id, form.title);

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(sharableUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handleCopyEmbed = async () => {
    const ok = await copyToClipboard(embedCode);
    if (ok) {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2200);
    }
  };

  const emailSubject = encodeURIComponent(`Please complete: ${form.title}`);
  const emailBody = encodeURIComponent(
    `Hi,\n\nPlease take a couple of minutes to fill out our interactive form "${form.title}":\n\n${sharableUrl}\n\nThank you!`
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="share-modal-title" maxWidth="xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <Share2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 id="share-modal-title" className="font-headline-sm text-base font-bold text-slate-900 leading-tight">
              Share & Collect Responses
            </h2>
            <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
              Target Form: <span className="font-semibold text-slate-700">{form.title}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center px-6 pt-3 border-b border-slate-100 gap-6 bg-white">
        <button
          onClick={() => setActiveTab('link')}
          className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
            activeTab === 'link'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Sharable Link</span>
        </button>
        <button
          onClick={() => setActiveTab('embed')}
          className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
            activeTab === 'embed'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Embed HTML</span>
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
            activeTab === 'invite'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email Invite</span>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {activeTab === 'link' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono-code mb-1.5">
                Unique Form Collection URL
              </label>
              <div className="flex items-stretch rounded-xl border border-slate-200 bg-slate-50/80 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600/15 overflow-hidden shadow-2xs transition">
                <div className="flex items-center pl-3.5 pr-1 text-slate-400">
                  <Globe className="w-4 h-4 text-emerald-600" />
                </div>
                <input
                  type="text"
                  readOnly
                  value={sharableUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 bg-transparent px-2.5 py-2.5 text-xs text-slate-800 font-mono-code focus:outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {copiedLink ? (
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
              </div>
            </div>

            {/* Information pill & Actions */}
            <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/70 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-800">Direct Respondent Mode</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Anyone with this unique link opens directly into the full-screen interactive form flow.
                    Submissions are immediately recorded into your workspace analytics.
                  </p>
                </div>
              </div>

              {onOpenLiveDemo && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenLiveDemo();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1 shrink-0 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <span>Test Flow</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Form Telemetry Quick Summary */}
            <div className="grid grid-cols-3 gap-3 pt-1 text-center font-mono-code">
              <div className="p-3 rounded-xl border border-slate-200/70 bg-white shadow-2xs">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Form ID</span>
                <span className="font-bold text-xs text-slate-800 truncate block mt-1">
                  {form.id}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200/70 bg-white shadow-2xs">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Questions</span>
                <span className="font-bold text-xs text-slate-800 block mt-1">
                  {form.steps.length} Steps
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200/70 bg-white shadow-2xs">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Status</span>
                <span className="font-bold text-xs text-emerald-600 flex items-center justify-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Accepting
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'embed' && (
          <div className="space-y-3">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono-code">
              iFrame Embed Code
            </label>
            <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-200 font-mono-code text-xs overflow-x-auto shadow-inner">
              <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-300">
                {embedCode}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Paste into Webflow, WordPress, Notion, or any HTML page.
              </span>
              <button
                onClick={handleCopyEmbed}
                className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                  copiedEmbed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {copiedEmbed ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied HTML!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Embed Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'invite' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>Send Direct Email Invitation</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate a pre-filled invitation email to send directly to respondents or clients with the unique link.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <a
                  href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition shadow-xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Open Email Client</span>
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link Instead</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 font-mono-code shrink-0">
        <span>Target: ?form={form.id}</span>
        <Button type="button" variant="secondary" size="sm" onClick={onClose} className="font-sans">
          Done
        </Button>
      </div>
    </Modal>
  );
};
