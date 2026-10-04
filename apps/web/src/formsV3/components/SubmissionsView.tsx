import React, { useState, useMemo, useEffect } from 'react';
import {
  Inbox,
  Clock,
  CheckCircle2,
  FileDown,
  Trash2,
  Calendar,
  Layers,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  BarChart2,
  Eye,
  EyeOff,
  Target,
  Filter,
  Link2,
  Check,
  Mail,
} from 'lucide-react';
import type { FormSubmission, FormConfig } from '../types';
import { SubmissionsAnalytics } from './SubmissionsAnalytics';
import { getSharableFormUrl, copyToClipboard } from '../utils/shareUtils';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';

interface SubmissionsViewProps {
  submissions: FormSubmission[];
  activeForm: FormConfig;
  availableForms?: FormConfig[];
  formStats?: Record<string, { starts: number; completions: number }>;
  onClearSubmissions: () => void;
  onBackToBuilder: () => void;
  onLaunchDemo: () => void;
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({
  submissions,
  activeForm,
  availableForms = [activeForm],
  formStats = {},
  onClearSubmissions,
  onBackToBuilder,
  onLaunchDemo,
}) => {
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(
    submissions[0] || null
  );
  const [showAnalytics, setShowAnalytics] = useState<boolean>(true);
  const [filterToActiveForm, setFilterToActiveForm] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleCopyLink = async () => {
    const url = getSharableFormUrl(activeForm.id);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const activeFormSubmissions = useMemo(
    () => submissions.filter((s) => s.formId === activeForm.id),
    [submissions, activeForm.id]
  );

  const displayedSubmissions = useMemo(
    () => (filterToActiveForm ? activeFormSubmissions : submissions),
    [filterToActiveForm, activeFormSubmissions, submissions]
  );

  useEffect(() => {
    if (displayedSubmissions.length > 0) {
      if (!selectedSubmission || !displayedSubmissions.find((s) => s.id === selectedSubmission.id)) {
        setSelectedSubmission(displayedSubmissions[0] ?? null);
      }
    } else {
      setSelectedSubmission(null);
    }
  }, [displayedSubmissions, selectedSubmission]);

  const totalSubmissions = displayedSubmissions.length;
  const avgTime =
    totalSubmissions > 0
      ? Math.round(
          displayedSubmissions.reduce((acc, curr) => acc + curr.completionTimeSeconds, 0) /
            totalSubmissions
        )
      : 0;

  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    // Collect all question IDs
    const allQuestionIds = Array.from<string>(
      new Set(submissions.flatMap((s) => Object.keys(s.responses)))
    );

    const questionHeaderLabels = allQuestionIds.map((qid) => {
      for (const form of availableForms) {
        const step = form.steps?.find((s) => s.id === qid);
        if (step?.title) return `"${step.title.replace(/"/g, '""')}"`;
      }
      return `"${qid}"`;
    });

    const headers = ['Submission ID', 'Form Title', 'Submitted At', 'Duration (s)', ...questionHeaderLabels];
    const rows = submissions.map((s) => [
      s.id,
      `"${s.formTitle.replace(/"/g, '""')}"`,
      s.submittedAt,
      s.completionTimeSeconds,
      ...allQuestionIds.map((qid) => {
        const val = s.responses[qid];
        const stringVal = Array.isArray(val) ? val.join('; ') : String(val ?? '');
        return `"${stringVal.replace(/"/g, '""')}"`;
      }),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `qubforms_responses_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono-code block">
              Data & Analytics
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-mono-code">
              <Target className="w-3 h-3 text-emerald-600" />
              Active Form: {activeForm.title}
            </span>
          </div>
          <h1 className="font-headline-sm text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Form Submissions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Telemetry insights, completion rates, and response trends over time for {activeForm.title}.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {submissions.length > 0 && (
            <>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-medium bg-white text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                title="Toggle visual charts"
              >
                <BarChart2 className="w-4 h-4 text-slate-500" />
                <span>{showAnalytics ? 'Hide Charts' : 'Show Charts'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-medium bg-white text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <FileDown className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={onClearSubmissions}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600 text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
                title="Clear all recorded submissions"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}

          <button
            onClick={handleCopyLink}
            title="Copy sharable collection link for active form"
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              copiedLink
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied Form Link!</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-slate-500" />
                <span>Copy Form Link</span>
              </>
            )}
          </button>

          <button
            onClick={onLaunchDemo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs shadow-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <span>Submit New Response</span>
          </button>
        </div>
      </div>

      {/* Recharts Analytics Data Visualization Section */}
      {submissions.length > 0 && showAnalytics && (
        <SubmissionsAnalytics
          submissions={submissions}
          activeForm={activeForm}
          availableForms={availableForms}
          formStats={formStats}
        />
      )}

      {/* Main Submissions Area */}
      {submissions.length === 0 ? (
        <div className="my-6">
          <EmptyState
            icon={Inbox}
            title="No responses recorded yet"
            description="Share your published form link or complete a test submission to view recorded answers and Recharts analytics here in real-time."
            action={
              <div className="flex items-center justify-center gap-3">
                <Button variant="accent" onClick={onLaunchDemo}>
                  Submit Response
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submission list */}
          <div className="lg:col-span-1 space-y-2">
            <div className="flex items-center justify-between mb-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setFilterToActiveForm(false)}
                  className={`px-2 py-1 rounded text-[11px] font-mono-code transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                    !filterToActiveForm
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({submissions.length})
                </button>
                <button
                  onClick={() => setFilterToActiveForm(true)}
                  className={`px-2 py-1 rounded text-[11px] font-mono-code transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                    filterToActiveForm
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Target className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Active ({activeFormSubmissions.length})</span>
                </button>
              </div>

              <span className="text-xs font-mono-code text-slate-400">
                Avg: {avgTime}s
              </span>
            </div>

            {displayedSubmissions.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No responses yet"
                description={`No responses recorded yet for ${activeForm.title}.`}
                action={
                  <Button variant="accent" size="sm" onClick={onLaunchDemo}>
                    Fill Active Form
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {displayedSubmissions.map((sub, idx) => {
                  const isSelected = selectedSubmission?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      aria-pressed={isSelected}
                      className={`w-full text-left p-4 rounded-xl border cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5 font-mono-code">
                        <span className={isSelected ? 'text-indigo-600' : 'text-slate-500'}>
                          #{String(displayedSubmissions.length - idx).padStart(2, '0')} · {sub.submittedAt}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sub.completionTimeSeconds}s
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold truncate mb-1">{sub.formTitle}</h4>

                      <div
                        className={`text-xs truncate ${
                          isSelected ? 'text-indigo-700' : 'text-slate-500'
                        }`}
                      >
                        {Object.values(sub.responses)[0]
                          ? String(Object.values(sub.responses)[0])
                          : 'Completed response'}
                      </div>

                      {sub.notificationSentTo && (
                        <div
                          className={`flex items-center gap-1 text-[10px] font-mono-code mt-2 ${
                            isSelected ? 'text-emerald-700' : 'text-emerald-600'
                          }`}
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">Alert sent: {sub.notificationSentTo}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submission Details view */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
                  <div>
                    <h3 className="font-headline-sm text-lg font-bold text-slate-900">
                      {selectedSubmission.formTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 font-mono-code mt-1">
                      <span>ID: {selectedSubmission.id}</span>
                      <span>·</span>
                      <span>{selectedSubmission.submittedAt}</span>
                      <span>·</span>
                      <span className="text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        Duration: {selectedSubmission.completionTimeSeconds}s
                      </span>
                    </div>

                    {selectedSubmission.notificationSentTo && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                        <Mail className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Response alert summary dispatched to{' '}
                          <strong className="font-mono-code">{selectedSubmission.notificationSentTo}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Question / Answers Breakdown */}
                <div className="space-y-3">
                  {Object.entries(selectedSubmission.responses).map(([questionId, value], i) => {
                    const parentForm =
                      availableForms.find((f) => f.id === selectedSubmission.formId) || activeForm;
                    const stepMeta = parentForm.steps.find((s) => s.id === questionId);
                    const prompt = stepMeta ? stepMeta.title : `Question ${i + 1}`;

                    return (
                      <div
                        key={questionId}
                        className="p-4 rounded-xl border border-slate-100 bg-slate-50/60"
                      >
                        <span className="text-xs font-semibold text-slate-500 block mb-1 font-mono-code">
                          {i + 1}. {prompt}
                        </span>
                        <div className="text-sm font-medium text-slate-900 mt-1 whitespace-pre-wrap">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 border border-slate-200 rounded-2xl">
                Select a submission on the left to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
