import React, { useState } from 'react';
import { X, FolderInput, Plus } from 'lucide-react';
import type { FormConfig } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface MoveFolderModalProps {
  form: FormConfig | null;
  isOpen: boolean;
  onClose: () => void;
  folders: string[];
  onMoveToFolder: (formId: string, folderName: string | undefined) => void;
  onAddNewFolder: (folderName: string) => void;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
  form,
  isOpen,
  onClose,
  folders,
  onMoveToFolder,
  onAddNewFolder,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>(form?.folder || '');
  const [newFolderName, setNewFolderName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!form) return null;

  const handleCreateAndSelectNewFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    onAddNewFolder(trimmed);
    setSelectedFolder(trimmed);
    setNewFolderName('');
    setIsAddingNew(false);
  };

  const handleSave = () => {
    onMoveToFolder(form.id, selectedFolder || undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="move-folder-title" maxWidth="md">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <FolderInput className="w-5 h-5" />
          </div>
          <div>
            <h3 id="move-folder-title" className="font-headline-sm text-base font-bold text-slate-900 tracking-tight">
              Move to Folder
            </h3>
            <p className="text-xs text-slate-500 font-normal">Reorganize form destination</p>
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

      <div className="p-6">
        <p className="text-xs text-slate-600 mb-3.5">
          Select destination category for <span className="font-bold text-slate-900">"{form.title}"</span>:
        </p>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-4">
          <label
            className={`flex items-center justify-between p-3 px-3.5 rounded-xl border text-xs cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-600 has-[:focus-visible]:ring-offset-2 ${
              selectedFolder === ''
                ? 'bg-indigo-50 text-indigo-700 border-indigo-600 font-semibold shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                : 'bg-slate-50/70 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            <span>None (Unassigned)</span>
            <input
              type="radio"
              name="folder-target"
              checked={selectedFolder === ''}
              onChange={() => setSelectedFolder('')}
              className="sr-only"
            />
          </label>

          {folders.map((f) => (
            <label
              key={f}
              className={`flex items-center justify-between p-3 px-3.5 rounded-xl border text-xs cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-600 has-[:focus-visible]:ring-offset-2 ${
                selectedFolder === f
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-600 font-semibold shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                  : 'bg-slate-50/70 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <span>{f}</span>
              <input
                type="radio"
                name="folder-target"
                checked={selectedFolder === f}
                onChange={() => setSelectedFolder(f)}
                className="sr-only"
              />
            </label>
          ))}
        </div>

        {/* Option to create a new folder */}
        {isAddingNew ? (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateAndSelectNewFolder();
                }
              }}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreateAndSelectNewFolder}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer shadow-xs shadow-indigo-600/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-700 p-1 mb-4 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create new folder</span>
          </button>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="accent" onClick={handleSave}>
            Move Form
          </Button>
        </div>
      </div>
    </Modal>
  );
};
