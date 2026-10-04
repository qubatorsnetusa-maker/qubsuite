import React, { useState } from 'react';
import {
  X,
  Trash2,
  FolderInput,
  CheckCircle2,
  Copy,
  Download,
  CheckSquare,
} from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface BatchActionsBarProps {
  selectedCount: number;
  totalCount: number;
  folders: string[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchStatusChange: (status: 'published' | 'draft' | 'closed') => void;
  onBatchMoveFolder: (folder: string) => void;
  onBatchDuplicate: () => void;
  onBatchExport: () => void;
  onBatchDelete: () => void;
}

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectedCount,
  totalCount,
  folders,
  onSelectAll,
  onClearSelection,
  onBatchStatusChange,
  onBatchMoveFolder,
  onBatchDuplicate,
  onBatchExport,
  onBatchDelete,
}) => {
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[94%] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-2.5 px-4 shadow-2xl border border-slate-800/90 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-6 duration-200 ring-1 ring-white/10">
      <div className="flex items-center gap-2.5 text-xs">
        <span className="w-6 h-6 rounded-full bg-indigo-400 text-indigo-950 flex items-center justify-center font-mono-code font-bold text-[11px] shadow-xs">
          {selectedCount}
        </span>
        <span className="font-semibold text-slate-200">Selected</span>

        {selectedCount < totalCount && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 cursor-pointer ml-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
          >
            Select all {totalCount}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Batch Status */}
        <button
          type="button"
          onClick={() => onBatchStatusChange('published')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 text-xs font-semibold transition cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          title="Publish selected forms"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Set Live</span>
        </button>

        {/* Batch Move to Folder */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFolderMenuOpen((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold transition cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Move to Folder"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Move</span>
          </button>

          {isFolderMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsFolderMenuOpen(false)}
              />
              <div className="absolute bottom-full mb-2.5 left-0 w-52 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 p-1.5 z-30 text-xs ring-1 ring-white/10 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono-code">
                  Assign to Folder:
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {folders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        onBatchMoveFolder(f);
                        setIsFolderMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-slate-200 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-inset"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Batch Duplicate */}
        <button
          type="button"
          onClick={onBatchDuplicate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold transition cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title="Duplicate selected forms"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Duplicate</span>
        </button>

        {/* Batch Export */}
        <button
          type="button"
          onClick={onBatchExport}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold transition cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title="Export selected forms as JSON"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Batch Delete */}
        <button
          type="button"
          onClick={() => setIsConfirmDeleteOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 text-xs font-semibold transition cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          title="Delete selected forms"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* Clear Selection */}
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title="Clear Selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          onBatchDelete();
          setIsConfirmDeleteOpen(false);
        }}
        title={`Delete ${selectedCount} Form${selectedCount === 1 ? '' : 's'}`}
        description={`Are you sure you want to delete the ${selectedCount} selected form${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmText="Delete Selected"
      />
    </div>
  );
};
