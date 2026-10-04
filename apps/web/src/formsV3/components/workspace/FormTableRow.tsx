import React, { useState } from 'react';
import {
  MoreHorizontal,
  Star,
  Play,
  Edit3,
  Copy,
  Trash2,
  FolderInput,
  Download,
  Link2,
  Check,
  FileEdit,
  Inbox,
  TrendingUp,
  Layers,
} from 'lucide-react';
import type { FormConfig } from '../../types';
import { FORM_THEMES } from '../../data/defaultForms';
import { getSharableFormUrl, copyToClipboard } from '../../utils/shareUtils';

interface FormTableRowProps {
  form: FormConfig;
  submissionsCount: number;
  startsCount: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (form: FormConfig) => void;
  onPreview: (form: FormConfig) => void;
  onViewSubmissions: (form: FormConfig) => void;
  onDuplicate: (form: FormConfig) => void;
  onRename: (form: FormConfig) => void;
  onMoveFolder: (form: FormConfig) => void;
  onChangeStatus: (form: FormConfig, status: 'published' | 'draft' | 'closed') => void;
  onExportForm: (form: FormConfig) => void;
  onDelete: (form: FormConfig) => void;
}

export const FormTableRow: React.FC<FormTableRowProps> = ({
  form,
  submissionsCount,
  startsCount,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  onEdit,
  onPreview,
  onViewSubmissions,
  onDuplicate,
  onRename,
  onMoveFolder,
  onChangeStatus,
  onExportForm,
  onDelete,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // FORM_THEMES (src/data/defaultForms.ts) is a non-empty static list.
  const theme = FORM_THEMES.find((t) => t.id === form.themeId) || FORM_THEMES[0]!;
  // No tracked starts but real responses exist: treat as fully converted
  // (100%) rather than inventing an arbitrary rate.
  const completionRate =
    startsCount > 0
      ? Math.min(100, Math.round((submissionsCount / startsCount) * 100))
      : submissionsCount > 0
      ? 100
      : 0;
  const status = form.status || 'published';

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(getSharableFormUrl(form.id));
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const primaryColor =
    form.customPalette?.primaryColorHex ||
    form.primaryColor ||
    theme.primaryColorHex ||
    '#18181B';

  return (
    <tr
      className={`group transition-colors border-b border-slate-100 hover:bg-slate-50/70 ${
        isSelected ? 'bg-indigo-50/70' : ''
      }`}
    >
      {/* Checkbox & Star */}
      <td className="py-3.5 pl-4 pr-2 w-12">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(form.id)}
            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer accent-indigo-600"
          />
          <button
            type="button"
            onClick={() => onToggleFavorite(form.id)}
            className={`p-1 rounded-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              form.isFavorite
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-slate-300 hover:text-slate-400'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${form.isFavorite ? 'fill-amber-500' : ''}`} />
          </button>
        </div>
      </td>

      {/* Title & Theme Swatch */}
      <td className="py-3.5 px-3 min-w-[240px]">
        <div className="flex items-center gap-3">
          <span
            className="w-2.5 h-7 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onEdit(form)}
              className="block text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-700 hover:underline cursor-pointer truncate text-left tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
              title={form.title}
            >
              {form.title}
            </button>
            <div className="text-[11px] text-slate-500 truncate max-w-xs font-normal">
              {form.description || 'No description'}
            </div>
          </div>
        </div>
      </td>

      {/* Folder */}
      <td className="py-3.5 px-3 text-xs text-slate-600">
        {form.folder ? (
          <span className="px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-600 text-[11px] font-mono-code font-semibold border border-slate-200/60">
            {form.folder}
          </span>
        ) : (
          <span className="text-slate-400 text-xs italic">Unassigned</span>
        )}
      </td>

      {/* Status Dropdown */}
      <td className="py-3.5 px-3">
        <select
          value={status}
          onChange={(e) => onChangeStatus(form, e.target.value as 'published' | 'draft' | 'closed')}
          className={`text-[10px] font-bold uppercase tracking-wider font-mono-code px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all shadow-2xs appearance-none ${
            status === 'published'
              ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/80'
              : status === 'draft'
              ? 'bg-amber-50/90 text-amber-800 border-amber-200/80 hover:bg-amber-100/80'
              : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/70'
          }`}
        >
          <option value="published">● Live</option>
          <option value="draft">● Draft</option>
          <option value="closed">● Closed</option>
        </select>
      </td>

      {/* Steps */}
      <td className="py-3.5 px-3 text-xs font-mono-code text-slate-700">
        <span className="flex items-center gap-1 font-semibold">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          {form.steps.length}
        </span>
      </td>

      {/* Responses */}
      <td className="py-3.5 px-3 text-xs font-mono-code font-bold text-slate-900">
        <button
          type="button"
          onClick={() => onViewSubmissions(form)}
          className="hover:underline flex items-center gap-1 text-slate-800 hover:text-indigo-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
        >
          <Inbox className="w-3.5 h-3.5 text-slate-400" />
          {submissionsCount}
        </button>
      </td>

      {/* Conversion Rate */}
      <td className="py-3.5 px-3 text-xs font-mono-code font-bold text-indigo-700 min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="w-9">{completionRate}%</span>
          <div className="w-12 h-1.5 bg-indigo-100 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-indigo-600 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
            />
          </div>
        </div>
      </td>

      {/* Last Updated */}
      <td className="py-3.5 px-3 text-[11px] text-slate-400 font-mono-code">
        {form.updatedAt || 'Recently'}
      </td>

      {/* Actions */}
      <td className="py-3.5 pl-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-1.5 relative">
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            title="Copy Form Link"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onPreview(form)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            title="Interactive Preview"
          >
            <Play className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(form)}
            className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Context Menu */}
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 z-30 animate-in fade-in zoom-in-95 text-xs text-left ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onViewSubmissions(form);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                >
                  <Inbox className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Responses</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDuplicate(form);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duplicate Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRename(form);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                >
                  <FileEdit className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rename Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onMoveFolder(form);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                >
                  <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                  <span>Move to Folder...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onExportForm(form);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Export JSON</span>
                </button>

                <div className="border-t border-slate-100 my-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete(form);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-inset"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete Form</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
