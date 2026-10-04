import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  History,
  HardDrive,
  Download,
  Trash2,
  RotateCcw,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  Layers,
  ArrowDownToLine,
  RefreshCw
} from 'lucide-react';
import type { FormConfig, DraftRevision } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ConfirmDeleteModal } from './workspace/ConfirmDeleteModal';
import {
  getDraftRevisions,
  formatRelativeDraftTime,
  getLocalStorageDiagnostics,
  exportAllDraftsBackup,
  clearDraftRevisions,
  saveDraftToStorage
} from '../utils/draftUtils';

interface OfflineDraftManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormConfig;
  isOnline: boolean;
  lastAutoSavedTime?: string | null;
  onRestoreRevision: (revisionForm: FormConfig) => void;
  onForceSave: () => void;
}

export function OfflineDraftManagerModal({
  isOpen,
  onClose,
  form,
  isOnline,
  lastAutoSavedTime,
  onRestoreRevision,
  onForceSave,
}: OfflineDraftManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'revisions' | 'storage'>('status');
  const [revisions, setRevisions] = useState<DraftRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<DraftRevision | null>(null);
  const [restoreSuccessId, setRestoreSuccessId] = useState<string | null>(null);
  const [diag, setDiag] = useState(getLocalStorageDiagnostics());
  const [confirmRestoreRev, setConfirmRestoreRev] = useState<DraftRevision | null>(null);
  const [isConfirmClearRevisionsOpen, setIsConfirmClearRevisionsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const revs = getDraftRevisions(form.id);
      setRevisions(revs);
      setDiag(getLocalStorageDiagnostics());
      if (revs.length > 0) {
        setSelectedRevision(revs[0] ?? null);
      }
    }
  }, [isOpen, form.id]);

  const handleRestore = (rev: DraftRevision) => {
    setConfirmRestoreRev(rev);
  };

  const executeRestore = (rev: DraftRevision) => {
    onRestoreRevision(rev.formSnapshot);
    setRestoreSuccessId(rev.id);
    setTimeout(() => {
      setRestoreSuccessId(null);
      onClose();
    }, 900);
  };

  const handleClearFormRevisions = () => {
    setIsConfirmClearRevisionsOpen(true);
  };

  const executeClearFormRevisions = () => {
    clearDraftRevisions(form.id);
    setRevisions([]);
    setSelectedRevision(null);
    setDiag(getLocalStorageDiagnostics());
  };

  const handleManualCheckpoint = () => {
    onForceSave();
    saveDraftToStorage(form, !isOnline, 'manual_save');
    setTimeout(() => {
      setRevisions(getDraftRevisions(form.id));
      setDiag(getLocalStorageDiagnostics());
    }, 200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="offline-draft-manager-title" maxWidth="2xl">
      <div className="flex flex-col h-full">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <h2 id="offline-draft-manager-title" className="font-headline-sm text-base font-bold text-slate-900 flex items-center gap-2 leading-tight">
                <span>Offline & Draft Persistence</span>
                <span
                  className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full ${
                    isOnline
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Continuous background storage & local versioning for uninterrupted drafting
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Persistence Status</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('revisions')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              activeTab === 'revisions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version History ({revisions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              activeTab === 'storage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Storage & Backup</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB: STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Connection Status Card */}
              <div
                className={`p-4 rounded-xl border ${
                  isOnline
                    ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                    : 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                      isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {isOnline ? 'Active Connection · Synced' : 'Offline Mode Active'}
                    </h3>
                    <p className="text-xs leading-relaxed opacity-90">
                      {isOnline
                        ? 'Service Worker cache is fully initialized. Your drafts and theme modifications are persistently mirrored to browser storage after every keystroke. If your connection drops, you can continue working without interruptions.'
                        : 'No internet connection detected. You are safe to continue drafting! All form steps, theme configurations, logic branches, and validation rules are preserved locally in browser storage.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Active Form Snapshot Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide font-mono-code">
                    Active Form Draft State
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono-code flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Last saved: {lastAutoSavedTime || 'just now'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[11px] text-slate-400 font-medium">Form Title</div>
                    <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                      {form.title}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[11px] text-slate-400 font-medium">Total Steps</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {form.steps.length} questions
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200/60 col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-slate-400 font-medium">Theme Primary</div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: form.primaryColor || form.customPalette?.primaryColorHex || '#0F172A' }}
                      />
                      <span className="truncate">{form.primaryColor || form.customPalette?.primaryColorHex || '#0F172A'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleManualCheckpoint}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Create Checkpoint Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportAllDraftsBackup}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export JSON Backup</span>
                  </button>
                </div>
              </div>

              {/* Service Worker Details */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-slate-700">PWA Service Worker Engine:</span>
                  <span className="text-slate-500 font-mono-code text-[11px]">
                    Auto-cache & App Shell Enabled
                  </span>
                </div>
                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* TAB: REVISIONS */}
          {activeTab === 'revisions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Automatic snapshots are recorded during your drafting sessions. You can preview and
                  restore any prior version.
                </span>
                {revisions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFormRevisions}
                    className="text-rose-600 hover:text-rose-700 font-medium text-xs flex items-center gap-1 cursor-pointer shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear History</span>
                  </button>
                )}
              </div>

              {revisions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
                  <History className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">No revisions recorded yet</p>
                  <p>As you add questions and modify forms, auto-save checkpoints appear here.</p>
                  <button
                    type="button"
                    onClick={handleManualCheckpoint}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Snapshot Now</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {revisions.map((rev, index) => {
                    const isSelected = selectedRevision?.id === rev.id;
                    const isRestored = restoreSuccessId === rev.id;

                    return (
                      <div
                        key={rev.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRevision(rev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedRevision(rev);
                          }
                        }}
                        aria-pressed={isSelected}
                        className={`p-3 rounded-xl transition cursor-pointer flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                          isSelected
                            ? 'border-2 border-indigo-600 bg-indigo-50 shadow-xs'
                            : 'border border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span
                              className={`font-mono-code font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                                isSelected
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {index === 0 ? 'Latest Snapshot' : `Version #${revisions.length - index}`}
                            </span>
                            <span
                              className={`font-mono-code text-[10px] ${
                                isSelected ? 'text-indigo-500' : 'text-slate-500'
                              }`}
                            >
                              {formatRelativeDraftTime(rev.timestamp)}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-bold truncate mt-1 ${
                              isSelected ? 'text-indigo-900' : 'text-slate-900'
                            }`}
                          >
                            {rev.formTitle}
                          </h4>

                          <div
                            className={`flex items-center gap-2 text-[11px] mt-1.5 ${
                              isSelected ? 'text-indigo-600' : 'text-slate-500'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {rev.stepCount} steps
                            </span>
                            <span>·</span>
                            <span className="capitalize">{rev.source.replace('_', ' ')}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(rev);
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                              isRestored
                                ? 'bg-emerald-500 text-white'
                                : isSelected
                                ? 'bg-indigo-700 text-white hover:bg-indigo-800'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {isRestored ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Restored!</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore This Version</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: STORAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Local Browser Storage Diagnostics</span>
                  <span className="font-mono-code text-slate-500">
                    {diag.formattedQubFormsSize} / ~5 MB quota
                  </span>
                </div>

                {/* Quota Progress Bar */}
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, diag.quotaPercent)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[10px] text-slate-400 font-mono-code">TOTAL STORAGE</div>
                    <div className="text-xs font-bold text-slate-900">{diag.formattedTotalSize}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[10px] text-slate-400 font-mono-code">FORMS DATA</div>
                    <div className="text-xs font-bold text-slate-900">{diag.formattedQubFormsSize}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[10px] text-slate-400 font-mono-code">ACTIVE DRAFTS</div>
                    <div className="text-xs font-bold text-slate-900">{diag.draftCount} forms</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="text-[10px] text-slate-400 font-mono-code">SAVED REVISIONS</div>
                    <div className="text-xs font-bold text-slate-900">{diag.revisionCount} snapshots</div>
                  </div>
                </div>
              </div>

              {/* Export Backup Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Download Offline JSON Package</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save a complete backup of all local drafts, themes, and responses to your device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportAllDraftsBackup}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>Download Backup</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1.5 font-mono-code text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted local sandbox · Instant recovery</span>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!confirmRestoreRev}
        onClose={() => setConfirmRestoreRev(null)}
        onConfirm={() => {
          if (confirmRestoreRev) {
            executeRestore(confirmRestoreRev);
            setConfirmRestoreRev(null);
          }
        }}
        title="Restore Revision Snapshot"
        description="Are you sure you want to restore this version? It will replace the current content of the form with this snapshot."
        confirmText="Restore Snapshot"
      />

      <ConfirmDeleteModal
        isOpen={isConfirmClearRevisionsOpen}
        onClose={() => setIsConfirmClearRevisionsOpen(false)}
        onConfirm={() => {
          executeClearFormRevisions();
          setIsConfirmClearRevisionsOpen(false);
        }}
        title="Clear Version History"
        description="Are you sure you want to clear all version history snapshots for this form? Your current draft will remain safe."
        confirmText="Clear History"
      />
    </Modal>
  );
}
