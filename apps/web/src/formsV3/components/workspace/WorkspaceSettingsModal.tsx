import React, { useState } from 'react';
import {
  X,
  Settings,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  Check,
  FolderKanban,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { Workspace } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onUpdateWorkspace: (updated: Workspace) => Promise<void>;
  onExportWorkspace: () => void;
  onResetWorkspaceForms: () => Promise<void>;
  onSeedTemplates?: () => Promise<void>;
}

const AVAILABLE_ICONS = ['✦', '🚀', '👥', '💡', '📊', '⚡', '🎯', '🌿', '📦', '🔥'];

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onUpdateWorkspace,
  onExportWorkspace,
  onResetWorkspaceForms,
  onSeedTemplates,
}) => {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [icon, setIcon] = useState(workspace.icon || '✦');
  const [folders, setFolders] = useState<string[]>(workspace.folders || []);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    setFolders([...folders, trimmed]);
    setNewFolderName('');
  };

  const handleRemoveFolder = (folderToRemove: string) => {
    setFolders(folders.filter((f) => f !== folderToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onUpdateWorkspace({
        ...workspace,
        name: name.trim() || 'My Workspace',
        description: description.trim(),
        icon: icon,
        folders: folders,
      });
      setIsSavedToast(true);
      setTimeout(() => {
        setIsSavedToast(false);
        onClose();
      }, 600);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="workspace-settings-title" maxWidth="lg">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 id="workspace-settings-title" className="font-headline-sm text-base font-bold text-slate-900 tracking-tight">
              Workspace Settings
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Configure workspace name, branding icon, and folder taxonomy
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

      {/* Content */}
      <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">
        {/* Icon Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider font-mono-code">
            Workspace Icon / Avatar
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {AVAILABLE_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                  icon === ic
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105 ring-2 ring-indigo-600/20'
                    : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Name & Description */}
        <div>
          <label htmlFor="input-ws-settings-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Workspace Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-ws-settings-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
          />
        </div>

        <div>
          <label htmlFor="input-ws-settings-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Description
          </label>
          <input
            id="input-ws-settings-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Inquiries, feedback, and customer acquisition"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
          />
        </div>

        {/* Folders Management */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider font-mono-code">
            Folders & Categories ({folders.length})
          </label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {folders.map((f) => (
              <div
                key={f}
                className="flex items-center justify-between p-2 px-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-800 shadow-2xs"
              >
                <span className="font-semibold font-mono-code text-slate-800">{f}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFolder(f)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                  title="Delete folder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add folder input */}
          <div className="flex items-center gap-2 mt-2.5">
            <input
              type="text"
              placeholder="New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFolder(e);
                }
              }}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
            />
            <button
              type="button"
              onClick={handleAddFolder}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs shadow-indigo-600/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              Add
            </button>
          </div>
        </div>

        {/* Data Management & Danger Zone */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          {onSeedTemplates && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 shadow-2xs">
              <div>
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Curated Form Templates</span>
                </div>
                <div className="text-[11px] text-indigo-700/80">Add 6 production templates and folders to this workspace</div>
              </div>
              <button
                type="button"
                disabled={isSeeding}
                onClick={async () => {
                  setIsSeeding(true);
                  try {
                    await onSeedTemplates();
                    onClose();
                  } finally {
                    setIsSeeding(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isSeeding ? 'Adding…' : 'Add Templates'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
            <div>
              <div className="text-xs font-bold text-slate-900">Backup Workspace</div>
              <div className="text-[11px] text-slate-500">Download complete workspace JSON file</div>
            </div>
            <button
              type="button"
              onClick={onExportWorkspace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/40 border border-rose-200/70">
            <div>
              <div className="text-xs font-bold text-rose-900">Clear All Forms</div>
              <div className="text-[11px] text-rose-600 font-normal">Delete every form in this workspace</div>
            </div>
            <button
              type="button"
              onClick={() => setIsConfirmClearOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={isSaving}>
            {isSavedToast ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </span>
            ) : isSaving ? (
              'Saving...'
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>

      <ConfirmDeleteModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={async () => {
          setIsConfirmClearOpen(false);
          await onResetWorkspaceForms();
          onClose();
        }}
        title="Clear All Forms"
        description="Are you sure you want to delete every form in this workspace? This action cannot be undone."
        confirmText="Clear All Forms"
      />
    </Modal>
  );
};
