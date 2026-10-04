import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Plus,
  FolderKanban,
  Settings,
  Download,
  Upload,
  ChevronDown,
  Layers,
  Inbox,
  TrendingUp,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import type { Workspace } from '../../types';

interface WorkspaceHeaderProps {
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  userName: string;
  userEmail: string;
  onSignOut: () => void;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string, description: string) => void;
  onOpenCreateForm: () => void;
  onOpenSettings: () => void;
  onExportWorkspace: () => void;
  onImportForms: (e: React.ChangeEvent<HTMLInputElement>) => void;
  totalFormsCount: number;
  publishedFormsCount: number;
  totalSubmissionsCount: number;
  avgCompletionRate: number;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  currentWorkspace,
  workspaces,
  userName,
  userEmail,
  onSignOut,
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenCreateForm,
  onOpenSettings,
  onExportWorkspace,
  onImportForms,
  totalFormsCount,
  publishedFormsCount,
  totalSubmissionsCount,
  avgCompletionRate,
}) => {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isNewWsDialogOpen, setIsNewWsDialogOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  const handleCreateNewWsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    onCreateWorkspace(newWsName.trim(), newWsDesc.trim());
    setNewWsName('');
    setNewWsDesc('');
    setIsNewWsDialogOpen(false);
    setIsSwitcherOpen(false);
  };

  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {/* Top bar: Workspace Title, Switcher, and Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative">
            <div className="flex items-center gap-3.5">
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white flex items-center justify-center text-xl font-mono-code font-bold shadow-md shadow-indigo-600/20 border border-indigo-700/50 select-none shrink-0 ring-4 ring-indigo-100/80">
                {currentWorkspace.icon || '✦'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-headline-sm text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {currentWorkspace.name}
                  </h1>
                  <button
                    type="button"
                    id="btn-workspace-switcher"
                    onClick={() => setIsSwitcherOpen((prev) => !prev)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    title="Switch Workspace"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-xl font-normal">
                  {currentWorkspace.description || 'Manage and organize conversational forms in this space.'}
                </p>
              </div>
            </div>

            {/* Workspace Switcher Dropdown */}
            {isSwitcherOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsSwitcherOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2.5 w-76 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-30 animate-in fade-in zoom-in-95 ring-1 ring-black/5">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono-code">
                    Workspaces
                  </div>
                  <div className="space-y-1 my-1 max-h-60 overflow-y-auto pr-1">
                    {workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => {
                          onSelectWorkspace(ws.id);
                          setIsSwitcherOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                          ws.id === currentWorkspace.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="w-6 h-6 rounded-lg bg-slate-700 text-white text-[11px] flex items-center justify-center shrink-0">
                            {ws.icon || '✦'}
                          </span>
                          <span className="truncate">{ws.name}</span>
                        </div>
                        {ws.id === currentWorkspace.id && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-xs shadow-emerald-400/50" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSwitcherOpen(false);
                        setIsNewWsDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/80 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                      <span>Create New Workspace</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              id="btn-workspace-settings"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/80 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              title="Workspace Settings"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              type="button"
              id="btn-workspace-export"
              onClick={onExportWorkspace}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/80 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              title="Export all forms & configurations as JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <label
              htmlFor="input-workspace-import"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/80 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-600 has-[:focus-visible]:ring-offset-2"
              title="Import JSON Form Backup"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Import</span>
              <input
                id="input-workspace-import"
                type="file"
                accept=".json,application/json"
                onChange={onImportForms}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              id="btn-workspace-create-form"
              onClick={onOpenCreateForm}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold tracking-tight transition shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/30 cursor-pointer active:scale-[0.98] border border-indigo-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Form</span>
            </button>

            {/* Account Menu */}
            <div className="relative">
              <button
                type="button"
                id="btn-account-menu"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/80 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                title="Account"
              >
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 uppercase">
                  {userName.charAt(0)}
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate">{userName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isAccountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsAccountMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2.5 w-56 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-30 animate-in fade-in zoom-in-95 ring-1 ring-black/5">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Settings</span>
                    </Link>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Quick Metrics Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          {/* Total Forms Card */}
          <div className="group p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span className="font-semibold text-slate-600">Total Forms</span>
              <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Layers className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-code text-slate-900 tracking-tight">
                {totalFormsCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                {currentWorkspace.folders.length} categor{currentWorkspace.folders.length === 1 ? 'y' : 'ies'} defined
              </div>
            </div>
          </div>

          {/* Published & Active Card */}
          <div className="group p-4 rounded-2xl bg-gradient-to-br from-white via-white to-emerald-50/30 border border-emerald-200/70 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Forms
              </span>
              <span className="w-7 h-7 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-code text-emerald-700 tracking-tight">
                {publishedFormsCount}
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-1 font-medium">
                Actively collecting responses
              </div>
            </div>
          </div>

          {/* Total Responses Card */}
          <div
            className="p-4 rounded-2xl bg-gradient-to-br from-white via-white to-sky-50/30 border border-sky-200/70 shadow-2xs flex flex-col justify-between"
            title="Total submissions count"
          >
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="font-semibold text-sky-900 group-hover:text-sky-700 transition-colors">Total Responses</span>
              <span className="w-7 h-7 rounded-xl bg-sky-100/80 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors flex items-center justify-center">
                <Inbox className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-code text-slate-900 tracking-tight group-hover:text-sky-900">
                {totalSubmissionsCount}
              </div>
              <div className="text-[11px] text-sky-700/80 mt-1 font-medium flex items-center justify-between">
                <span>Stored submissions</span>
                <span className="text-[10px] text-sky-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
              </div>
            </div>
          </div>

          {/* Avg Completion Card */}
          <div className="group p-4 rounded-2xl bg-gradient-to-br from-white via-white to-indigo-50/40 border border-indigo-200/70 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="font-semibold text-indigo-900">Avg. Completion</span>
              <span className="w-7 h-7 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-code text-indigo-700 tracking-tight flex items-baseline gap-1">
                <span>{avgCompletionRate}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, avgCompletionRate))}%` }}
                  />
                </div>
                <span className="text-[10px] text-indigo-600/90 font-mono-code font-semibold">
                  rate
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Workspace Modal */}
      {isNewWsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-headline-sm text-base font-bold text-slate-900">Create New Workspace</h2>
                <p className="text-xs text-slate-500">Organize forms and teams into a separate workspace</p>
              </div>
            </div>
            <form onSubmit={handleCreateNewWsSubmit} className="space-y-4">
              <div>
                <label htmlFor="input-new-ws-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Workspace Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-new-ws-name"
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Growth Marketing & Brand"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/50 hover:bg-white focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="input-new-ws-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description (Optional)
                </label>
                <input
                  id="input-new-ws-desc"
                  type="text"
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="e.g. Inquiries, feedback, and customer acquisition"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition bg-slate-50/50 hover:bg-white focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewWsDialogOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs shadow-indigo-600/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
