import React, { useState } from 'react';
import { motion, AnimatePresence } from '../lib/motion';
import {
  Save,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  Link2,
  RotateCcw,
  ChevronUp,
  Cloud,
  ExternalLink,
  Sparkles,
  Plus,
} from 'lucide-react';
import { formatRelativeDraftTime } from '../utils/draftUtils';
import type { SaveStatus } from '../pages/FormBuilder';

interface BuilderFABProps {
  onSave: () => void;
  onSaveAndLaunchDemo: () => void;
  onCopyShareLink: () => void;
  onDiscardDraft?: () => void;
  onOpenAddQuestion?: () => void;
  hasDraft: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  isCopied?: boolean;
}

export const BuilderFAB: React.FC<BuilderFABProps> = ({
  onSave,
  onSaveAndLaunchDemo,
  onCopyShareLink,
  onDiscardDraft,
  onOpenAddQuestion,
  hasDraft,
  saveStatus,
  lastSavedAt,
  isCopied = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSaving = saveStatus === 'saving';
  const hasUnsavedChanges = saveStatus === 'pending';
  const hasError = saveStatus === 'error';

  return (
    <div
      id="builder-floating-actions"
      className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2.5 select-none pointer-events-none"
    >
      {/* Auto-save Status Floating Pill */}
      <AnimatePresence>
        {(isSaving || hasError || lastSavedAt || hasUnsavedChanges) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border backdrop-blur-md transition-all duration-200 ${
              isSaving
                ? 'bg-blue-50/95 border-blue-200 text-blue-700 shadow-blue-500/5'
                : hasError
                ? 'bg-rose-50/95 border-rose-200 text-rose-700 shadow-rose-500/5'
                : hasUnsavedChanges
                ? 'bg-amber-50/95 border-amber-200 text-amber-800 shadow-amber-500/5'
                : 'bg-white/90 border-slate-200/90 text-slate-700 shadow-slate-950/5'
            }`}
          >
            {isSaving ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                <span className="text-[11px] text-blue-700 font-mono-code font-medium">Saving changes…</span>
              </>
            ) : hasError ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-[11px] text-rose-700 font-mono-code font-semibold">Save failed · retry</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <span className="text-[11px] text-amber-800 font-medium">Unsaved changes</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-600 font-mono-code">
                  Saved {lastSavedAt ? `(${formatRelativeDraftTime(lastSavedAt)})` : ''}
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Quick Action Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto flex flex-col gap-1 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-200/90 min-w-[220px]"
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono-code">
              Quick Actions
            </div>

            {onOpenAddQuestion && (
              <button
                type="button"
                id="fab-quick-add-question"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAddQuestion();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 hover:text-black hover:bg-slate-100/90 transition text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
              >
                <span className="w-7 h-7 rounded-lg bg-indigo-600 group-hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-slate-900 leading-tight">Add Question</span>
                  <span className="text-[10px] text-slate-400 font-mono-code truncate">Open question dialog</span>
                </div>
              </button>
            )}

            <button
              type="button"
              id="fab-quick-launch-live"
              onClick={() => {
                setIsMenuOpen(false);
                onSaveAndLaunchDemo();
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/90 transition text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-600 group-hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/20 transition-colors">
                <Eye className="w-3.5 h-3.5" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-900 leading-tight">Launch Live Form</span>
                <span className="text-[10px] text-slate-400 font-mono-code truncate">Preview fullscreen</span>
              </div>
            </button>

            <button
              type="button"
              id="fab-quick-copy-link"
              onClick={() => {
                onCopyShareLink();
                setTimeout(() => setIsMenuOpen(false), 800);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/90 transition text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
            >
              <span className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition-colors">
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-900 leading-tight">{isCopied ? 'Link Copied!' : 'Copy Form Link'}</span>
                <span className="text-[10px] text-slate-400 font-mono-code truncate">Share with respondents</span>
              </div>
            </button>

            {hasDraft && onDiscardDraft && (
              <button
                type="button"
                id="fab-discard-draft"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDiscardDraft();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer border-t border-slate-100 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-inset"
              >
                <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-3.5 h-3.5" />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold leading-tight">Discard Draft</span>
                  <span className="text-[10px] text-rose-400 font-mono-code truncate">Revert to saved</span>
                </div>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Action Button (FAB) Cluster */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Speed-dial Toggle Button */}
        <button
          type="button"
          id="fab-toggle-menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-all duration-200 cursor-pointer backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
            isMenuOpen
              ? 'bg-indigo-600 text-white border-indigo-600 rotate-180'
              : 'bg-white/90 text-slate-700 border-slate-200/90 hover:bg-white hover:text-slate-900 shadow-slate-950/10'
          }`}
          title="More actions"
          aria-label="More mobile actions"
        >
          <ChevronUp className="w-4 h-4 transition-transform duration-200" />
        </button>

        {/* Primary Save / Submit Action Button */}
        <motion.button
          type="button"
          id="fab-primary-save-btn"
          whileTap={{ scale: 0.95 }}
          onClick={onSave}
          disabled={isSaving}
          className={`h-12 px-5 sm:px-6 rounded-full flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xl transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
            hasError
              ? 'bg-rose-600 text-white shadow-rose-600/30 hover:bg-rose-700'
              : hasUnsavedChanges
              ? 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-indigo-950/25 ring-2 ring-emerald-500/50'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
          }`}
          title="Save now (Ctrl/Cmd + S)"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Saving…</span>
            </>
          ) : hasError ? (
            <>
              <AlertCircle className="w-4 h-4 text-white" />
              <span>Retry Save</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-indigo-200" />
              <span>{hasUnsavedChanges ? 'Save Now' : 'Save Form'}</span>
              {hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400 ml-0.5 animate-pulse" />
              )}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
