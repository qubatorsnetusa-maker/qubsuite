import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { FormConfig, FormSubmission, FormSessionStats } from '../../types';
import { SubmissionsView } from '../../components/SubmissionsView';
import { Footer } from '../../components/Footer';
import { clearWorkspaceSubmissionsFn } from '@/formsV3/api/workspaces';
import { getSharableFormUrl } from '../../utils/shareUtils';
import { ConfirmDeleteModal } from '../../components/workspace/ConfirmDeleteModal';

interface SubmissionsPageProps {
  workspaceId: string;
  forms: FormConfig[];
  formStats: Record<string, FormSessionStats>;
  submissions: FormSubmission[];
  activeFormId?: string;
}

export default function SubmissionsPage({
  workspaceId,
  forms,
  formStats,
  submissions: initialSubmissions,
  activeFormId,
}: SubmissionsPageProps) {
  const navigate = useNavigate();
  const clearWorkspaceSubmissions = clearWorkspaceSubmissionsFn;

  const [submissions, setSubmissions] = useState<FormSubmission[]>(initialSubmissions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const currentForm = useMemo(
    () => forms.find((f) => f.id === activeFormId) || forms[0],
    [forms, activeFormId],
  );

  const handleClearSubmissions = () => {
    setIsConfirmClearOpen(true);
  };

  const executeClearSubmissions = async () => {
    try {
      await clearWorkspaceSubmissions({ data: { workspaceId } });
      setSubmissions([]);
    } catch {
      setErrorMessage('Could not clear submissions. Please try again.');
    }
  };

  const handleLaunchDemo = () => {
    if (!currentForm) return;
    // Opens the real published respondent link so an owner can submit a
    // genuine test response through the actual public flow, instead of
    // fabricating a submission locally.
    window.open(getSharableFormUrl(currentForm.id), '_blank', 'noopener,noreferrer');
  };

  if (!currentForm) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
        <main className="flex-1 flex items-center justify-center p-12 text-center">
          <div>
            <p className="text-slate-600 mb-4">This workspace doesn't have any forms yet.</p>
            <button
              type="button"
              onClick={() => navigate({ to: '/formsv3' as any })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to workspace
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <button
            type="button"
            onClick={() => navigate({ to: '/formsv3' as any })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to workspace
          </button>
        </div>
        <SubmissionsView
          submissions={submissions}
          activeForm={currentForm}
          availableForms={forms}
          formStats={formStats}
          onClearSubmissions={handleClearSubmissions}
          onBackToBuilder={() => navigate({ to: '/formsv3' as any })}
          onLaunchDemo={handleLaunchDemo}
        />
      </main>

      {errorMessage && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-rose-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="underline underline-offset-2 font-semibold"
            onClick={() => setErrorMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={async () => {
          setIsConfirmClearOpen(false);
          await executeClearSubmissions();
        }}
        title="Clear All Submissions"
        description="Are you sure you want to delete every recorded response for this workspace? This action cannot be undone."
        confirmText="Delete All Submissions"
      />

      <Footer />
    </div>
  );
}
