import React, { useState, useEffect } from 'react';
import { X, FileEdit } from 'lucide-react';
import type { FormConfig } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface RenameFormModalProps {
  form: FormConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (formId: string, newTitle: string, newDescription: string) => void;
}

export const RenameFormModal: React.FC<RenameFormModalProps> = ({
  form,
  isOpen,
  onClose,
  onRename,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description || '');
    }
  }, [form]);

  if (!form) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onRename(form.id, title.trim(), description.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="rename-form-title" maxWidth="md">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <h3 id="rename-form-title" className="font-headline-sm text-base font-bold text-slate-900 tracking-tight">
              Rename Form
            </h3>
            <p className="text-xs text-slate-500 font-normal">Update title and display description</p>
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
            <label htmlFor="input-rename-form-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Form Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-rename-form-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/40 hover:bg-white focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="input-rename-form-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              id="input-rename-form-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition resize-none bg-slate-50/40 hover:bg-white focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
