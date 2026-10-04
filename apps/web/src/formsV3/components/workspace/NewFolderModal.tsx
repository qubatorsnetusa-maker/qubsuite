import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFolders: string[];
  onCreateFolder: (folderName: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  onClose,
  existingFolders,
  onCreateFolder,
}) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      setError('Please enter a folder name.');
      return;
    }
    if (existingFolders.includes(trimmed)) {
      setError(`Folder "${trimmed}" already exists.`);
      return;
    }
    onCreateFolder(trimmed);
    setFolderName('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="new-folder-title" maxWidth="md">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 id="new-folder-title" className="font-headline-sm text-base font-bold text-slate-900 tracking-tight">
              Create New Folder
            </h3>
            <p className="text-xs text-slate-500 font-normal">Organize forms into categories</p>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="input-new-folder-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Folder Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-new-folder-name"
              type="text"
              required
              autoFocus
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Marketing, Feedback, Inbound"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
            />
            {error && <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent">
              Create Folder
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
