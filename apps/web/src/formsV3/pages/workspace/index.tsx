import { useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { FormConfig, FormSubmission, Workspace } from '../../types';
import { WorkspaceView } from '../../components/WorkspaceView';
import { Footer } from '../../components/Footer';
import { getSharableFormUrl } from '../../utils/shareUtils';
import { logoutFn } from '@/formsV3/api/auth';
import type { UserPreferences } from '@/formsV3/api/preferences';
import {
  createFormFn,
  createWorkspaceFn,
  deleteFormFn,
  duplicateFormFn,
  incrementFormStartFn,
  listWorkspaceFormsFn,
  listWorkspaceSubmissionsFn,
  resetWorkspaceFormsFn,
  seedWorkspaceTemplatesFn,
  updateFormFn,
  updateWorkspaceFn,
} from '@/formsV3/api/workspaces';

type FormSessionStats = { starts: number; completions: number };

interface WorkspacePageProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  forms: FormConfig[];
  formStats: Record<string, FormSessionStats>;
  submissions: FormSubmission[];
  userName: string;
  userEmail: string;
  preferences: UserPreferences;
}

export function WorkspacePage({
  workspaces: initialWorkspaces,
  activeWorkspaceId: initialActiveWorkspaceId,
  forms: initialForms,
  formStats: initialFormStats,
  submissions: initialSubmissions,
  userName,
  userEmail,
  preferences,
}: WorkspacePageProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(initialActiveWorkspaceId);
  const [forms, setForms] = useState<FormConfig[]>(initialForms);
  const [formStats, setFormStats] = useState<Record<string, FormSessionStats>>(initialFormStats);
  const [submissions, setSubmissions] = useState<FormSubmission[]>(initialSubmissions);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const router = useRouter();
  const logout = logoutFn;

  const handleSignOut = async () => {
    await logout();
    await router.invalidate();
    await router.navigate({ to: '/login' });
  };

  const listWorkspaceForms = listWorkspaceFormsFn;
  const listWorkspaceSubmissions = listWorkspaceSubmissionsFn;
  const createWorkspace = createWorkspaceFn;
  const updateWorkspace = updateWorkspaceFn;
  const createForm = createFormFn;
  const updateForm = updateFormFn;
  const deleteForm = deleteFormFn;
  const duplicateForm = duplicateFormFn;
  const resetWorkspaceForms = resetWorkspaceFormsFn;
  const seedWorkspaceTemplates = seedWorkspaceTemplatesFn;
  const incrementFormStart = incrementFormStartFn;

  // Every mutation below funnels failures through this — a toast the user
  // actually sees, instead of a swallowed rejection and a UI that quietly
  // reverts on the next reload with no explanation.
  function reportError(message: string) {
    setErrorMessage(message);
  }

  async function loadWorkspaceData(workspaceId: string) {
    setIsSwitchingWorkspace(true);
    try {
      const [formsResult, submissionsResult] = await Promise.all([
        listWorkspaceForms({ data: { workspaceId } }),
        listWorkspaceSubmissions({ data: { workspaceId } }),
      ]);
      setForms(formsResult.forms);
      setFormStats(formsResult.formStats);
      setSubmissions(submissionsResult.submissions);
    } catch {
      reportError('Could not load that workspace. Please try again.');
    } finally {
      setIsSwitchingWorkspace(false);
    }
  }

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    void loadWorkspaceData(id);
  };

  // Re-thrown on failure (rather than only setting the toast) so the
  // Create-Form modal's own await can keep itself open and show its inline
  // error instead of closing as if the form were actually created.
  const handleCreateForm = async (newForm: FormConfig) => {
    try {
      const { form } = await createForm({ data: { ...newForm, workspaceId: activeWorkspaceId } });
      setForms((prev) => [form, ...prev]);
      setFormStats((prev) => ({ ...prev, [form.id]: { starts: 0, completions: 0 } }));
      navigate({ to: '/formsv3/$formId' as any, params: { formId: form.id } as any });
    } catch (err) {
      reportError('Could not create the form.');
      throw err;
    }
  };

  // Bulk import: awaited sequentially (not fired concurrently) so results are
  // deterministic, and the view never navigates away mid-batch — it stays on
  // the workspace list and reports how many of the batch actually succeeded.
  const handleImportForms = async (importedForms: FormConfig[]) => {
    let imported = 0;
    let failed = 0;
    for (const f of importedForms) {
      try {
        const { form } = await createForm({
          data: { ...f, workspaceId: activeWorkspaceId },
        });
        setForms((prev) => [form, ...prev]);
        setFormStats((prev) => ({ ...prev, [form.id]: { starts: 0, completions: 0 } }));
        imported += 1;
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      reportError(
        imported > 0
          ? `Imported ${imported} form(s); ${failed} failed.`
          : 'Import failed — no forms were created.',
      );
    }
    return { imported, failed };
  };

  const handleCreateWorkspace = async (name: string, description: string) => {
    try {
      const { workspace } = await createWorkspace({ data: { name, description } });
      setWorkspaces((prev) => [...prev, workspace]);
      setActiveWorkspaceId(workspace.id);
      setForms([]);
      setFormStats({});
      setSubmissions([]);
    } catch {
      reportError('Could not create the workspace.');
    }
  };

  const handleUpdateWorkspace = async (updated: Workspace) => {
    try {
      const { workspace } = await updateWorkspace({
        data: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          icon: updated.icon,
          folders: updated.folders,
        },
      });
      setWorkspaces((prev) => prev.map((w) => (w.id === workspace.id ? workspace : w)));
    } catch {
      reportError('Could not save workspace settings.');
    }
  };

  const handleUpdateForm = async (updated: FormConfig) => {
    try {
      const { form } = await updateForm({ data: { ...updated } });
      setForms((prev) => prev.map((f) => (f.id === form.id ? form : f)));
    } catch {
      reportError('Could not save changes to the form.');
    }
  };

  const handleDeleteForm = async (formId: string) => {
    try {
      await deleteForm({ data: { id: formId } });
      setForms((prev) => prev.filter((f) => f.id !== formId));
      setSubmissions((prev) => prev.filter((s) => s.formId !== formId));
      setFormStats((prev) => {
        const { [formId]: _removed, ...rest } = prev;
        return rest;
      });
    } catch {
      reportError('Could not delete the form.');
    }
  };

  const handleDuplicateForm = async (form: FormConfig) => {
    try {
      const { form: duplicated } = await duplicateForm({ data: { id: form.id } });
      setForms((prev) => [duplicated, ...prev]);
      setFormStats((prev) => ({ ...prev, [duplicated.id]: { starts: 0, completions: 0 } }));
    } catch {
      reportError('Could not duplicate the form.');
    }
  };

  const handleResetWorkspaceForms = async () => {
    try {
      const result = await resetWorkspaceForms({ data: { workspaceId: activeWorkspaceId } });
      setForms(result.forms);
      setFormStats(result.formStats);
    } catch {
      reportError('Could not reset the workspace.');
    }
  };

  const handleSeedWorkspaceTemplates = async () => {
    setIsSwitchingWorkspace(true);
    try {
      const result = await seedWorkspaceTemplates({ data: { workspaceId: activeWorkspaceId } });
      setForms(result.forms);
      setFormStats(result.formStats);
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspaceId ? { ...w, folders: result.folders } : w))
      );
    } catch {
      reportError('Could not seed templates into workspace.');
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  const handleSelectAndPreview = async (form: FormConfig) => {
    let targetForm = form;
    if (form.status !== 'published') {
      try {
        const { form: published } = await updateForm({ data: { ...form, status: 'published' } });
        setForms((prev) => prev.map((f) => (f.id === published.id ? published : f)));
        targetForm = published;
      } catch {
        reportError('Could not publish form for live preview.');
        return;
      }
    }
    window.open(getSharableFormUrl(targetForm.id), '_blank', 'noopener,noreferrer');
    try {
      const { stats } = await incrementFormStart({ data: { id: targetForm.id } });
      setFormStats((prev) => ({ ...prev, [targetForm.id]: stats }));
    } catch {
      // Non-critical
    }
  };

  const handleSelectAndEdit = (form: FormConfig) => {
    navigate({ to: '/formsv3/$formId' as any, params: { formId: form.id } as any });
  };

  const handleViewSubmissions = (form: FormConfig) => {
    navigate({ to: '/formsv3/$formId/submissions' as any, params: { formId: form.id } as any, search: { workspaceId: activeWorkspaceId } as any });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 selection:bg-indigo-600 selection:text-white relative">
      {/* Subtle atmospheric ambient glow in the background */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/60 via-slate-50/20 to-transparent pointer-events-none -z-10" />

      <main className="flex-1 flex flex-col relative z-0">
        <WorkspaceView
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          userName={userName}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          initialViewMode={preferences.defaultViewMode}
          initialSortOption={preferences.defaultSortOption}
          notifyOnSubmission={preferences.notifyOnSubmission}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          onUpdateWorkspace={handleUpdateWorkspace}
          forms={forms}
          submissions={submissions}
          sessionStats={formStats}
          onEditForm={handleSelectAndEdit}
          onPreviewForm={handleSelectAndPreview}
          onViewSubmissions={handleViewSubmissions}
          onCreateForm={handleCreateForm}
          onImportForms={handleImportForms}
          onUpdateForm={handleUpdateForm}
          onDeleteForm={handleDeleteForm}
          onDuplicateForm={handleDuplicateForm}
          onResetWorkspaceForms={handleResetWorkspaceForms}
          onSeedWorkspaceTemplates={handleSeedWorkspaceTemplates}
        />

        {/* Seamless workspace switching overlay */}
        {isSwitchingWorkspace && (
          <div className="fixed inset-0 z-50 bg-slate-950/20 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-200">
            <div className="px-5 py-3 rounded-2xl bg-slate-900/95 text-white text-xs font-semibold shadow-2xl border border-slate-700/60 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
              <span>Switching workspace…</span>
            </div>
          </div>
        )}

        {/* Modern Toast Notification */}
        {errorMessage && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-rose-500/40 backdrop-blur-md text-xs font-medium animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-slate-200">{errorMessage}</span>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
