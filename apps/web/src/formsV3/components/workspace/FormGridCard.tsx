import React, { useState } from 'react';
import {
  MoreVertical,
  Star,
  Layers,
  Inbox,
  TrendingUp,
  Play,
  Edit3,
  Copy,
  Trash2,
  FolderInput,
  Download,
  Link2,
  Check,
  Globe,
  FileEdit,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { FormConfig } from '../../types';
import { FORM_THEMES } from '../../data/defaultForms';
import { getSharableFormUrl, copyToClipboard } from '../../utils/shareUtils';

interface FormGridCardProps {
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

export const FormGridCard: React.FC<FormGridCardProps> = ({
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
  const completionRate = startsCount > 0 ? Math.min(100, Math.round((submissionsCount / startsCount) * 100)) : (submissionsCount > 0 ? 100 : 0);
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
    <div
      className={`group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 ${
        isSelected
          ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/15 shadow-md'
          : 'bg-white border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top Card Theme Accent Glow Ribbon */}
      <div className="h-1.5 w-full relative overflow-hidden">
        <div
          className="h-full w-full transition-all duration-300"
          style={{ backgroundColor: primaryColor }}
        />
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {/* Header: Checkbox, Star, Folder, Status, & More Menu */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(form.id)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer accent-indigo-600"
            />
            <button
              type="button"
              onClick={() => onToggleFavorite(form.id)}
              className={`p-1 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                form.isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
              }`}
              title={form.isFavorite ? 'Remove from Starred' : 'Star form'}
            >
              <Star className={`w-4 h-4 ${form.isFavorite ? 'fill-amber-500' : ''}`} />
            </button>
            {form.folder && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-600 text-[11px] font-medium font-mono-code truncate max-w-[130px] border border-slate-200/60">
                {form.folder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 relative shrink-0">
            {/* Status Pill with toggle dropdown */}
            <div className="relative flex items-center">
              <select
                value={status}
                onChange={(e) =>
                  onChangeStatus(form, e.target.value as 'published' | 'draft' | 'closed')
                }
                className={`text-[10px] font-bold uppercase tracking-wider font-mono-code pl-2.5 pr-2 py-1 rounded-full border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 transition-all shadow-2xs appearance-none ${
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
            </div>

            {/* More Actions Menu Button */}
            <button
              type="button"
              id={`btn-form-card-menu-${form.id}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Dropdown Menu */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 z-30 animate-in fade-in zoom-in-95 text-xs ring-1 ring-black/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEdit(form);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open in Builder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onPreview(form);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                  >
                    <Play className="w-3.5 h-3.5 text-slate-400" />
                    <span>Interactive Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onViewSubmissions(form);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
                  >
                    <Inbox className="w-3.5 h-3.5 text-slate-400" />
                    <span>View Submissions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDuplicate(form);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-inset"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete Form</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <h3
              onClick={() => onEdit(form)}
              className="font-headline-sm text-base font-bold text-slate-900 group-hover:text-indigo-700 line-clamp-1 hover:underline cursor-pointer tracking-tight"
              title={form.title}
            >
              {form.title}
            </h3>
          </div>
          <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px] leading-relaxed font-normal">
            {form.description || 'No description provided.'}
          </p>
        </div>

        {/* Performance Metrics Row */}
        <div className="grid grid-cols-3 gap-2 py-3 px-3.5 rounded-xl bg-slate-50/90 border border-slate-100 text-xs mb-4 mt-auto">
          <div>
            <span className="text-[10px] text-slate-400 font-mono-code font-bold block uppercase tracking-wider">
              Steps
            </span>
            <span className="font-bold text-slate-900 font-mono-code text-xs flex items-center gap-1 mt-0.5">
              <Layers className="w-3 h-3 text-slate-400" />
              {form.steps.length}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-mono-code font-bold block uppercase tracking-wider">
              Responses
            </span>
            <span className="font-bold text-slate-900 font-mono-code text-xs flex items-center gap-1 mt-0.5">
              <Inbox className="w-3 h-3 text-slate-400" />
              {submissionsCount}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-mono-code font-bold block uppercase tracking-wider">
              Conversion
            </span>
            <div className="mt-0.5">
              <span className="font-bold text-indigo-700 font-mono-code text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-indigo-500" />
                {completionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer Meta & Quick Link Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{form.updatedAt || 'Recently'}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-100 active:scale-95 transition cursor-pointer border border-transparent hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              title="Copy shareable link"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPreview(form)}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-100 active:scale-95 transition cursor-pointer flex items-center gap-1 border border-transparent hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              title="Test Preview form"
            >
              <Play className="w-3 h-3" />
              <span className="text-[10px] font-medium">Test</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(form)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer text-xs font-semibold shadow-xs hover:shadow active:scale-[0.98] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
