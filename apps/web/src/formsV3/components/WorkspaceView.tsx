import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Layers,
  Inbox,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  FolderOpen,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  FormConfig,
  Workspace,
  FormSubmission,
  FormSessionStats,
} from '../types';
import { WorkspaceHeader } from './workspace/WorkspaceHeader';
import { WorkspaceFilterBar } from './workspace/WorkspaceFilterBar';
import type {
  WorkspaceSortOption,
  WorkspaceStatusFilter,
} from './workspace/WorkspaceFilterBar';
import { FormGridCard } from './workspace/FormGridCard';
import { FormTableRow } from './workspace/FormTableRow';
import { CreateFormModal } from './workspace/CreateFormModal';
import { WorkspaceSettingsModal } from './workspace/WorkspaceSettingsModal';
import { BatchActionsBar } from './workspace/BatchActionsBar';
import { RenameFormModal } from './workspace/RenameFormModal';
import { MoveFolderModal } from './workspace/MoveFolderModal';
import { NewFolderModal } from './workspace/NewFolderModal';
import { ConfirmDeleteModal } from './workspace/ConfirmDeleteModal';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';

interface WorkspaceViewProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
  initialViewMode?: 'grid' | 'table';
  initialSortOption?: WorkspaceSortOption;
  notifyOnSubmission: boolean;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string, description: string) => Promise<void>;
  onUpdateWorkspace: (updated: Workspace) => Promise<void>;
  forms: FormConfig[];
  submissions: FormSubmission[];
  sessionStats: Record<string, FormSessionStats>;
  onEditForm: (form: FormConfig) => void;
  onPreviewForm: (form: FormConfig) => void;
  onViewSubmissions: (form: FormConfig) => void;
  onCreateForm: (newForm: FormConfig) => Promise<void>;
  onImportForms: (forms: FormConfig[]) => Promise<{ imported: number; failed: number }>;
  onUpdateForm: (updated: FormConfig) => Promise<void>;
  onDeleteForm: (formId: string) => Promise<void>;
  onDuplicateForm: (form: FormConfig) => Promise<void>;
  onResetWorkspaceForms: () => Promise<void>;
  onSeedWorkspaceTemplates?: () => Promise<void>;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  workspaces,
  activeWorkspaceId,
  userName,
  userEmail,
  onSignOut,
  initialViewMode,
  initialSortOption,
  notifyOnSubmission,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  forms,
  submissions,
  sessionStats,
  onEditForm,
  onPreviewForm,
  onViewSubmissions,
  onCreateForm,
  onImportForms,
  onUpdateForm,
  onDeleteForm,
  onDuplicateForm,
  onResetWorkspaceForms,
  onSeedWorkspaceTemplates,
}) => {
  // Current active workspace
  const currentWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<WorkspaceStatusFilter>('all');
  const [sortOption, setSortOption] = useState<WorkspaceSortOption>(initialSortOption ?? 'updated_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(initialViewMode ?? 'grid');

  // Multi-selection state
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);

  // Dialog states
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renamingForm, setRenamingForm] = useState<FormConfig | null>(null);
  const [movingForm, setMovingForm] = useState<FormConfig | null>(null);
  const [deletingForm, setDeletingForm] = useState<FormConfig | null>(null);
  const [importToast, setImportToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Submissions count map
  const submissionsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach((sub) => {
      map[sub.formId] = (map[sub.formId] || 0) + 1;
    });
    return map;
  }, [submissions]);

  // Calculated overall metrics
  const totalFormsCount = forms.length;
  const publishedFormsCount = forms.filter((f) => (f.status || 'published') === 'published').length;
  const totalSubmissionsCount = submissions.length;

  const avgCompletionRate = useMemo(() => {
    let totalStarts = 0;
    let totalCompletions = 0;
    Object.values(sessionStats).forEach((stat: FormSessionStats) => {
      totalStarts += stat.starts;
      totalCompletions += stat.completions;
    });
    if (totalStarts === 0) return 0;
    return Math.min(100, Math.round((totalCompletions / totalStarts) * 100));
  }, [sessionStats]);

  // Filter and Sort forms
  const filteredAndSortedForms = useMemo(() => {
    return forms
      .filter((form) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = form.title.toLowerCase().includes(q);
          const matchDesc = (form.description || '').toLowerCase().includes(q);
          const matchFolder = (form.folder || '').toLowerCase().includes(q);
          const matchSteps = form.steps.some(
            (s) => s.title.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
          );
          if (!matchTitle && !matchDesc && !matchFolder && !matchSteps) {
            return false;
          }
        }

        // Folder filter
        if (selectedFolder === 'favorites') {
          if (!form.isFavorite) return false;
        } else if (selectedFolder !== 'all') {
          if (form.folder !== selectedFolder) return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const formStatus = form.status || 'published';
          if (formStatus !== statusFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const countA = submissionsCountMap[a.id] || 0;
        const countB = submissionsCountMap[b.id] || 0;
        const startsA = sessionStats[a.id]?.starts || 0;
        const startsB = sessionStats[b.id]?.starts || 0;
        // No tracked starts but real responses exist: treat as fully
        // converted (1) rather than inventing an arbitrary fractional rate.
        const rateA = startsA > 0 ? countA / startsA : countA > 0 ? 1 : 0;
        const rateB = startsB > 0 ? countB / startsB : countB > 0 ? 1 : 0;

        switch (sortOption) {
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'responses_desc':
            return countB - countA;
          case 'completion_desc':
            return rateB - rateA;
          case 'steps_desc':
            return b.steps.length - a.steps.length;
          case 'updated_desc':
          default:
            return (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
        }
      });
  }, [
    forms,
    searchQuery,
    selectedFolder,
    statusFilter,
    sortOption,
    submissionsCountMap,
    sessionStats,
  ]);

  // Toggle single selection
  const handleToggleSelect = (formId: string) => {
    setSelectedFormIds((prev) =>
      prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId]
    );
  };

  // Select all visible
  const handleSelectAll = () => {
    setSelectedFormIds(filteredAndSortedForms.map((f) => f.id));
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedFormIds([]);
  };

  // Toggle favorite
  const handleToggleFavorite = (formId: string) => {
    const target = forms.find((f) => f.id === formId);
    if (target) {
      onUpdateForm({
        ...target,
        isFavorite: !target.isFavorite,
        updatedAt: 'Just now',
      });
    }
  };

  // Change status
  const handleChangeStatus = (
    form: FormConfig,
    newStatus: 'published' | 'draft' | 'closed'
  ) => {
    onUpdateForm({
      ...form,
      status: newStatus,
      updatedAt: 'Just now',
    });
  };

  // Export single form
  const handleExportSingleForm = (form: FormConfig) => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(form, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${form.id}-${form.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export full workspace
  const handleExportWorkspace = () => {
    // Guarded again here even though line 394 already returns an empty
    // state when there's no workspace: this closure is defined before that
    // guard runs, so TypeScript can't see it protects this call site too.
    if (!currentWorkspace) return;
    const workspaceBundle = {
      workspace: currentWorkspace,
      forms: forms,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(workspaceBundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `workspace-${currentWorkspace.id}-backup.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON forms — the actual creation is delegated to onImportForms,
  // which awaits each form sequentially and never navigates away mid-batch
  // (see pages/workspace/index.tsx). Server-generated ids replace these
  // client-side placeholders, so the exact prefix here doesn't matter.
  const handleImportForms = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.forms && Array.isArray(parsed.forms)) {
          const { imported, failed } = await onImportForms(
            parsed.forms.map((f: FormConfig) => ({ ...f, updatedAt: 'Just now' })),
          );
          if (failed === 0) {
            setImportToast({ message: `Successfully imported ${imported} form(s) into workspace!`, type: 'success' });
          } else {
            setImportToast({ message: `Imported ${imported} form(s), ${failed} failed.`, type: 'error' });
          }
          setTimeout(() => setImportToast(null), 4000);
        } else if (parsed.title && parsed.steps) {
          const { imported } = await onImportForms([{ ...parsed, updatedAt: 'Just now' }]);
          if (imported > 0) {
            setImportToast({ message: `Successfully imported "${parsed.title}"!`, type: 'success' });
          }
          setTimeout(() => setImportToast(null), 4000);
        } else {
          setImportToast({ message: 'Invalid form JSON file format.', type: 'error' });
          setTimeout(() => setImportToast(null), 4000);
        }
      } catch (err) {
        setImportToast({ message: 'Could not parse JSON file. Please ensure it is valid JSON.', type: 'error' });
        setTimeout(() => setImportToast(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Batch operations
  const handleBatchStatusChange = async (status: 'published' | 'draft' | 'closed') => {
    const targets = forms.filter((f) => selectedFormIds.includes(f.id));
    await Promise.all(targets.map((f) => onUpdateForm({ ...f, status, updatedAt: 'Just now' })));
    handleClearSelection();
  };

  const handleBatchMoveFolder = async (folder: string) => {
    const targets = forms.filter((f) => selectedFormIds.includes(f.id));
    await Promise.all(targets.map((f) => onUpdateForm({ ...f, folder, updatedAt: 'Just now' })));
    handleClearSelection();
  };

  const handleBatchDuplicate = async () => {
    const targets = forms.filter((f) => selectedFormIds.includes(f.id));
    for (const f of targets) {
      await onDuplicateForm(f);
    }
    handleClearSelection();
  };

  const handleBatchExport = () => {
    const selectedForms = forms.filter((f) => selectedFormIds.includes(f.id));
    const bundle = {
      exportedAt: new Date().toISOString(),
      forms: selectedForms,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `qub-selected-forms-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    handleClearSelection();
  };

  const handleBatchDelete = async () => {
    for (const id of selectedFormIds) {
      await onDeleteForm(id);
    }
    handleClearSelection();
  };

  // Rename single form
  const handleRenameSubmit = (formId: string, newTitle: string, newDesc: string) => {
    const target = forms.find((f) => f.id === formId);
    if (target) {
      onUpdateForm({
        ...target,
        title: newTitle,
        description: newDesc,
        updatedAt: 'Just now',
      });
    }
  };

  // Move single form folder
  const handleMoveFolderSubmit = (formId: string, targetFolder: string | undefined) => {
    const target = forms.find((f) => f.id === formId);
    if (target) {
      onUpdateForm({
        ...target,
        folder: targetFolder,
        updatedAt: 'Just now',
      });
    }
  };

  // Add new folder to workspace
  const handleAddNewFolder = () => {
    setIsNewFolderOpen(true);
  };

  const handleCreateFolderSubmit = (folderName: string) => {
    if (!currentWorkspace) return;
    if (!currentWorkspace.folders.includes(folderName)) {
      onUpdateWorkspace({
        ...currentWorkspace,
        folders: [...currentWorkspace.folders, folderName],
      });
      setSelectedFolder(folderName);
    }
  };

  // Defensive: the /workspace loader always provisions a first workspace for
  // a new account, but this view has no other way to render sensibly if the
  // list is ever empty (e.g. a future "delete workspace" action removing the
  // last one) — better an explicit prompt than a crash reading `.folders`
  // off `undefined`.
  if (!currentWorkspace) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <EmptyState
          icon={FolderOpen}
          title="No workspace yet"
          description="Create a workspace to start building forms."
          action={
            <Button variant="accent" onClick={() => onCreateWorkspace('My Workspace', '')}>
              <Plus className="w-4 h-4" />
              Create workspace
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Workspace Header with metrics & switcher */}
      <WorkspaceHeader
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        userName={userName}
        userEmail={userEmail}
        onSignOut={onSignOut}
        onSelectWorkspace={onSelectWorkspace}
        onCreateWorkspace={onCreateWorkspace}
        onOpenCreateForm={() => setIsCreateFormOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportWorkspace={handleExportWorkspace}
        onImportForms={handleImportForms}
        totalFormsCount={totalFormsCount}
        publishedFormsCount={publishedFormsCount}
        totalSubmissionsCount={totalSubmissionsCount}
        avgCompletionRate={avgCompletionRate}
      />

      {/* Main Workspace Body */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Filter Controls Bar */}
        <WorkspaceFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          folders={currentWorkspace.folders}
          onAddNewFolder={handleAddNewFolder}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalMatchingCount={filteredAndSortedForms.length}
        />

        {/* Form List / Grid View */}
        {filteredAndSortedForms.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAndSortedForms.map((form) => {
                const subCount = submissionsCountMap[form.id] || 0;
                const starts = sessionStats[form.id]?.starts || 0;
                const isSelected = selectedFormIds.includes(form.id);

                return (
                  <FormGridCard
                    key={form.id}
                    form={form}
                    submissionsCount={subCount}
                    startsCount={starts}
                    isSelected={isSelected}
                    onToggleSelect={handleToggleSelect}
                    onToggleFavorite={handleToggleFavorite}
                    onEdit={onEditForm}
                    onPreview={onPreviewForm}
                    onViewSubmissions={onViewSubmissions}
                    onDuplicate={onDuplicateForm}
                    onRename={(f) => setRenamingForm(f)}
                    onMoveFolder={(f) => setMovingForm(f)}
                    onChangeStatus={handleChangeStatus}
                    onExportForm={handleExportSingleForm}
                    onDelete={(f) => setDeletingForm(f)}
                  />
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono-code">
                      <th scope="col" className="py-3.5 pl-4 pr-2 w-12">
                        <input
                          type="checkbox"
                          aria-label="Select all forms"
                          checked={
                            selectedFormIds.length === filteredAndSortedForms.length &&
                            filteredAndSortedForms.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) handleSelectAll();
                            else handleClearSelection();
                          }}
                          className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer accent-indigo-600"
                        />
                      </th>
                      <th scope="col" className="py-3.5 px-3">Form Name</th>
                      <th scope="col" className="py-3.5 px-3">Folder</th>
                      <th scope="col" className="py-3.5 px-3">Status</th>
                      <th scope="col" className="py-3.5 px-3">Steps</th>
                      <th scope="col" className="py-3.5 px-3">Responses</th>
                      <th scope="col" className="py-3.5 px-3">Conversion</th>
                      <th scope="col" className="py-3.5 px-3">Updated</th>
                      <th scope="col" className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedForms.map((form) => {
                      const subCount = submissionsCountMap[form.id] || 0;
                      const starts = sessionStats[form.id]?.starts || 0;
                      const isSelected = selectedFormIds.includes(form.id);

                      return (
                        <FormTableRow
                          key={form.id}
                          form={form}
                          submissionsCount={subCount}
                          startsCount={starts}
                          isSelected={isSelected}
                          onToggleSelect={handleToggleSelect}
                          onToggleFavorite={handleToggleFavorite}
                          onEdit={onEditForm}
                          onPreview={onPreviewForm}
                          onViewSubmissions={onViewSubmissions}
                          onDuplicate={onDuplicateForm}
                          onRename={(f) => setRenamingForm(f)}
                          onMoveFolder={(f) => setMovingForm(f)}
                          onChangeStatus={handleChangeStatus}
                          onExportForm={handleExportSingleForm}
                          onDelete={(f) => setDeletingForm(f)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Empty Search / Filter State */
          <EmptyState
            icon={FolderOpen}
            title="No forms found"
            description={
              searchQuery
                ? `No forms match your search query "${searchQuery}". Try clearing your filters.`
                : selectedFolder !== 'all'
                ? `No forms currently assigned to the "${selectedFolder}" folder.`
                : 'Get started by creating your first conversational form in this workspace.'
            }
            action={
              <div className="flex items-center justify-center gap-2">
                {(searchQuery || selectedFolder !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFolder('all');
                      setStatusFilter('all');
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
                <Button variant="accent" size="sm" onClick={() => setIsCreateFormOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Form</span>
                </Button>
              </div>
            }
          />
        )}
      </main>

      {/* Floating Batch Actions Toolbar */}
      <BatchActionsBar
        selectedCount={selectedFormIds.length}
        totalCount={filteredAndSortedForms.length}
        folders={currentWorkspace.folders}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBatchStatusChange={handleBatchStatusChange}
        onBatchMoveFolder={handleBatchMoveFolder}
        onBatchDuplicate={handleBatchDuplicate}
        onBatchExport={handleBatchExport}
        onBatchDelete={handleBatchDelete}
      />

      {/* Create Form Modal */}
      <CreateFormModal
        isOpen={isCreateFormOpen}
        onClose={() => setIsCreateFormOpen(false)}
        folders={currentWorkspace.folders}
        activeFolder={selectedFolder}
        onCreateForm={onCreateForm}
        notifyOnSubmission={notifyOnSubmission}
        userEmail={userEmail}
      />

      {/* Workspace Settings Modal */}
      <WorkspaceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        workspace={currentWorkspace}
        onUpdateWorkspace={onUpdateWorkspace}
        onExportWorkspace={handleExportWorkspace}
        onResetWorkspaceForms={onResetWorkspaceForms}
        onSeedTemplates={onSeedWorkspaceTemplates}
      />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        existingFolders={currentWorkspace.folders}
        onCreateFolder={handleCreateFolderSubmit}
      />

      {/* Rename Form Modal */}
      <RenameFormModal
        form={renamingForm}
        isOpen={!!renamingForm}
        onClose={() => setRenamingForm(null)}
        onRename={handleRenameSubmit}
      />

      {/* Move to Folder Modal */}
      <MoveFolderModal
        form={movingForm}
        isOpen={!!movingForm}
        onClose={() => setMovingForm(null)}
        folders={currentWorkspace.folders}
        onMoveToFolder={handleMoveFolderSubmit}
        onAddNewFolder={(f) => {
          onUpdateWorkspace({
            ...currentWorkspace,
            folders: [...currentWorkspace.folders, f],
          });
        }}
      />

      {/* Delete Form Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingForm}
        onClose={() => setDeletingForm(null)}
        onConfirm={() => {
          if (deletingForm) {
            onDeleteForm(deletingForm.id);
            setDeletingForm(null);
          }
        }}
        title={`Delete "${deletingForm?.title || 'Form'}"`}
        description="Are you sure you want to delete this form? Any responses or links associated with it may no longer be available."
        confirmText="Delete Form"
      />

      {/* Toast Notification for Import / Feedback */}
      {importToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md bg-white text-slate-800 border-slate-200">
          <span className={`w-2.5 h-2.5 rounded-full ${importToast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <p className="text-xs font-medium">{importToast.message}</p>
          <button
            type="button"
            onClick={() => setImportToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
