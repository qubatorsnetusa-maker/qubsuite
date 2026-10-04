import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  BarChart3,
  Timer,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Activity,
  Calendar,
  Sparkles,
  Target,
} from 'lucide-react';
import type { FormConfig, FormSubmission } from '../types';

interface SubmissionsAnalyticsProps {
  submissions: FormSubmission[];
  activeForm: FormConfig;
  availableForms: FormConfig[];
  formStats?: Record<string, { starts: number; completions: number }>;
}

type TabType = 'overview' | 'trends' | 'completion' | 'timing';

export const SubmissionsAnalytics: React.FC<SubmissionsAnalyticsProps> = ({
  submissions,
  activeForm,
  availableForms,
  formStats = {},
}) => {
  // Focus on the active form by default
  const [selectedFormId, setSelectedFormId] = useState<string>(activeForm.id);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Keep selectedFormId synchronized when activeForm changes
  useEffect(() => {
    setSelectedFormId(activeForm.id);
  }, [activeForm.id]);

  const isActiveFormSelected = selectedFormId === activeForm.id;

  // Filter submissions by selected form or all
  const filteredSubmissions = useMemo(() => {
    if (selectedFormId === 'all') return submissions;
    return submissions.filter((s) => s.formId === selectedFormId);
  }, [submissions, selectedFormId]);

  // Determine active form object
  const currentSelectedForm = useMemo(() => {
    if (selectedFormId === 'all') return activeForm;
    return availableForms.find((f) => f.id === selectedFormId) || activeForm;
  }, [selectedFormId, activeForm, availableForms]);

  // Calculate Average, Min, Max, Median response time
  const timingStats = useMemo(() => {
    if (filteredSubmissions.length === 0) {
      return { avg: 0, min: 0, max: 0, median: 0, list: [] };
    }

    const durations = filteredSubmissions.map((s) => s.completionTimeSeconds);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / durations.length);
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    const sorted = [...durations].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    // Guarded above by the `filteredSubmissions.length === 0` early return,
    // so `sorted` is always non-empty here — the `?? 0` is unreachable but
    // keeps this within noUncheckedIndexedAccess without an assertion.
    const median =
      sorted.length % 2 !== 0
        ? (sorted[mid] ?? 0)
        : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);

    return { avg, min, max, median, list: durations };
  }, [filteredSubmissions]);

  // Calculate completion rate stats
  const completionStats = useMemo(() => {
    let totalStarts = 0;
    const totalCompleted = filteredSubmissions.length;

    if (selectedFormId === 'all') {
      const formsToCheck = availableForms.length > 0 ? availableForms : [activeForm];
      formsToCheck.forEach((f) => {
        const stats = formStats[f.id];
        const formSubCount = submissions.filter((s) => s.formId === f.id).length;
        // No tracked starts for this form: treat its known responses as
        // fully converted rather than inventing an extra "started" count.
        totalStarts += stats ? Math.max(stats.starts, formSubCount) : formSubCount;
      });
      if (totalStarts < totalCompleted) totalStarts = totalCompleted;
    } else {
      const stats = formStats[selectedFormId];
      totalStarts = stats ? Math.max(stats.starts, totalCompleted) : totalCompleted;
    }

    const rate = totalStarts > 0 ? Math.round((totalCompleted / totalStarts) * 100) : 100;
    const dropOffCount = Math.max(0, totalStarts - totalCompleted);

    return {
      starts: totalStarts,
      completions: totalCompleted,
      rate,
      dropOffCount,
    };
  }, [filteredSubmissions, selectedFormId, availableForms, activeForm, formStats, submissions]);

  // Chronological response timeline data for Trends Over Time (oldest to newest)
  const responseTimelineData = useMemo(() => {
    const list = [...filteredSubmissions].reverse(); // chronological order
    let cumulative = 0;
    let runningDurationSum = 0;

    return list.map((sub, idx) => {
      cumulative += 1;
      runningDurationSum += sub.completionTimeSeconds;
      const rollingAvg = Math.round(runningDurationSum / cumulative);

      return {
        seq: `#${idx + 1}`,
        id: sub.id,
        title: sub.formTitle,
        timeLabel: sub.submittedAt,
        cumulative,
        duration: sub.completionTimeSeconds,
        rollingAvg,
        overallAvg: timingStats.avg,
        diff: sub.completionTimeSeconds - timingStats.avg,
        answeredCount: Object.keys(sub.responses || {}).length,
      };
    });
  }, [filteredSubmissions, timingStats.avg]);

  // Question-by-Question completion rate funnel for current selected form
  const questionFunnelData = useMemo(() => {
    const relevantSteps = currentSelectedForm.steps.filter(
      (s) => s.type !== 'welcome' && s.type !== 'thank_you'
    );

    const relevantSubs =
      selectedFormId === 'all'
        ? submissions.filter((s) => s.formId === currentSelectedForm.id)
        : filteredSubmissions;

    const baseCount = relevantSubs.length;

    return relevantSteps.map((step, idx) => {
      const answeredCount = relevantSubs.filter((s) => {
        const val = s.responses[step.id];
        return val !== undefined && val !== null && val !== '' && (Array.isArray(val) ? val.length > 0 : true);
      }).length;

      const rate = baseCount > 0 ? Math.round((answeredCount / baseCount) * 100) : 100;
      const shortTitle = step.title.length > 22 ? `${step.title.slice(0, 20)}…` : step.title;

      return {
        stepNumber: `Q${idx + 1}`,
        fullTitle: step.title,
        label: `Q${idx + 1}: ${shortTitle}`,
        shortLabel: `Q${idx + 1}`,
        type: step.type,
        answeredCount,
        totalCount: baseCount,
        rate,
      };
    });
  }, [currentSelectedForm, selectedFormId, submissions, filteredSubmissions]);

  // Form comparison data (Completion rate & Avg response time per form)
  const formComparisonData = useMemo(() => {
    return availableForms.map((form) => {
      const formSubs = submissions.filter((s) => s.formId === form.id);
      const completions = formSubs.length;
      const stats = formStats[form.id];
      // No tracked starts for this form: treat its known responses as fully
      // converted rather than inventing an extra "started" count.
      const starts = stats ? Math.max(stats.starts, completions) : completions;
      const completionRate = starts > 0 ? Math.round((completions / starts) * 100) : 100;

      const avgDuration =
        completions > 0
          ? Math.round(formSubs.reduce((acc, c) => acc + c.completionTimeSeconds, 0) / completions)
          : 0;

      return {
        formId: form.id,
        formName: form.title.length > 20 ? `${form.title.slice(0, 18)}…` : form.title,
        fullName: form.title,
        completions,
        starts,
        completionRate,
        avgDuration,
        isActive: form.id === activeForm.id,
      };
    });
  }, [availableForms, submissions, formStats, activeForm.id]);

  // Response time distribution buckets (Histogram data)
  const pacingDistributionData = useMemo(() => {
    let under30 = 0;
    let between30and60 = 0;
    let between60and90 = 0;
    let over90 = 0;

    filteredSubmissions.forEach((s) => {
      const t = s.completionTimeSeconds;
      if (t < 30) under30++;
      else if (t <= 60) between30and60++;
      else if (t <= 90) between60and90++;
      else over90++;
    });

    return [
      { range: '< 30s', count: under30, label: 'Fast Pace' },
      { range: '30s – 60s', count: between30and60, label: 'Standard' },
      { range: '60s – 90s', count: between60and90, label: 'Deliberate' },
      { range: '> 90s', count: over90, label: 'Thorough' },
    ];
  }, [filteredSubmissions]);

  // The bucket with the most responses, for the "Dominant" pacing summary —
  // computed from the real distribution instead of a fixed label.
  const dominantPacingBucket = useMemo(() => {
    const empty = { range: 'N/A', count: 0, label: 'N/A' };
    return pacingDistributionData.reduce(
      (max, bucket) => (bucket.count > max.count ? bucket : max),
      empty,
    );
  }, [pacingDistributionData]);

  // Donut chart data: Completed vs Drop-off
  const pieData = useMemo(() => {
    return [
      { name: 'Completed', value: completionStats.completions, color: '#4F46E5' },
      { name: 'Drop-off / Incomplete', value: completionStats.dropOffCount, color: '#E2E8F0' },
    ];
  }, [completionStats]);

  if (submissions.length === 0) {
    return null;
  }

  return (
    <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      {/* Analytics Navigation & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
            {isActiveFormSelected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white font-mono-code">
                <Target className="w-3 h-3 text-emerald-400" />
                Active Form: {activeForm.title}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 font-mono-code">
                Scope: {currentSelectedForm.title}
              </span>
            )}
            <span className="text-xs font-mono-code text-slate-400">Recharts Visualizer</span>
          </div>

          <h2 className="font-headline-sm text-xl font-bold tracking-tight text-slate-900">
            {isActiveFormSelected
              ? `Performance & Response Trends: ${activeForm.title}`
              : `Performance & Submission Analytics`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualizing completion rates, question funnel retention, and response trends over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Active Form Focus Toggle */}
          <button
            onClick={() => setSelectedFormId(activeForm.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              isActiveFormSelected
                ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)] font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
            title="Focus on the active form currently selected in the builder"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Active Form</span>
          </button>

          {/* Form Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-600/15 focus-within:border-indigo-600 transition">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value={activeForm.id}>⭐ Active: {activeForm.title}</option>
              <option value="all">All Forms ({submissions.length} responses)</option>
              {availableForms
                .filter((f) => f.id !== activeForm.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
            </select>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 flex items-center gap-1 ${
                activeTab === 'trends'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Trends Over Time</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-mono-code">
                {filteredSubmissions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('completion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 flex items-center gap-1 ${
                activeTab === 'completion'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Completion Rate</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-mono-code">
                {completionStats.rate}%
              </span>
            </button>
            <button
              onClick={() => setActiveTab('timing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 flex items-center gap-1 ${
                activeTab === 'timing'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Response Time</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-700 font-mono-code">
                {timingStats.avg}s
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Highlights for the Active / Selected Form */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 my-6">
        {/* Completion Rate KPI */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1 font-mono-code">
            <span>COMPLETION RATE</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{completionStats.rate}%</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              Optimal
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {completionStats.completions} completed of {completionStats.starts} started
          </div>
        </div>

        {/* Response Trend / Total Responses KPI */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1 font-mono-code">
            <span>TOTAL RESPONSES</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{filteredSubmissions.length}</span>
            <span className="text-xs text-slate-500 font-mono-code">
              {isActiveFormSelected ? 'active form' : 'selected scope'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Latest: {filteredSubmissions[0]?.submittedAt || 'N/A'}
          </div>
        </div>

        {/* Average Response Time KPI */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1 font-mono-code">
            <span>AVG RESPONSE TIME</span>
            <Clock className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{timingStats.avg}s</span>
            <span className="text-xs text-slate-500 font-mono-code">
              Median: {timingStats.median}s
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Fastest: {timingStats.min}s · Slowest: {timingStats.max}s
          </div>
        </div>

        {/* Question Retention KPI */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1 font-mono-code">
            <span>FUNNEL RETENTION</span>
            <Layers className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {questionFunnelData.length > 0
                ? Math.round(
                    questionFunnelData.reduce((acc, q) => acc + q.rate, 0) /
                      questionFunnelData.length
                  )
                : 100}
              %
            </span>
            <span className="text-xs text-slate-500 font-mono-code">per step</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {questionFunnelData.length} questions in {currentSelectedForm.title}
          </div>
        </div>
      </div>

      {/* VIEW: Overview (Dual Side-by-Side: Response Trends Over Time + Step Completion Rate Funnel) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Response Trends Over Time (Cumulative Submissions & Arrival Velocity) */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Response Trends Over Time
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-blue-50 text-blue-700 font-medium">
                      {responseTimelineData.length} Responses
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cumulative response progression and chronological submission timeline for {currentSelectedForm.title}.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono-code text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                    Growth
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-blue-600 inline-block" />
                    Pace
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={responseTimelineData}
                    margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomTrendTooltip avgTime={timingStats.avg} />} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative Responses"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cumulativeGradient)"
                      activeDot={{ r: 5, fill: '#4F46E5', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-2 font-mono-code">
                <span>Earliest: {responseTimelineData[0]?.timeLabel || 'N/A'}</span>
                <span>Total Accumulated: {responseTimelineData.length}</span>
                <span>Latest: {responseTimelineData[responseTimelineData.length - 1]?.timeLabel || 'N/A'}</span>
              </div>
            </div>

            {/* Chart 2: Step-by-Step Question Completion Rate Funnel for the Form */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Question Completion Rate & Retention
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-emerald-50 text-emerald-700 font-medium">
                      {completionStats.rate}% Final
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Step-by-step conversion and drop-off percentage across questions in {currentSelectedForm.title}.
                  </p>
                </div>
                <span className="text-[11px] font-mono-code text-slate-400">
                  {questionFunnelData.length} Questions
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={questionFunnelData}
                    margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomCompletionTooltip />} />
                    <ReferenceLine
                      y={100}
                      stroke="#E2E8F0"
                      strokeDasharray="2 2"
                    />
                    <Bar
                      dataKey="rate"
                      name="Completion Rate"
                      fill="#4F46E5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    >
                      {questionFunnelData.map((entry, index) => (
                        <Cell
                          key={`overview-cell-${index}`}
                          fill={entry.rate >= 90 ? '#4F46E5' : entry.rate >= 75 ? '#475569' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-2 font-mono-code">
                <span>Start Step: 100%</span>
                <span>Drop-off Count: {completionStats.dropOffCount}</span>
                <span className="text-emerald-600 font-medium">
                  {completionStats.rate}% Overall Completion
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Overview Row: Response Pacing Trend + Session Conversion Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Response Time Duration Over Time */}
            <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Response Completion Time Over Time
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-slate-100 text-slate-700 font-medium">
                      Avg: {timingStats.avg}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Duration in seconds per submission chronologically with average benchmark.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Target: ~45–60s
                </span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={responseTimelineData}
                    margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="durationPacingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      unit="s"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomTimingTooltip avgTime={timingStats.avg} />} />
                    <ReferenceLine
                      y={timingStats.avg}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Avg ${timingStats.avg}s`,
                        position: 'insideTopRight',
                        fill: '#D97706',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="duration"
                      name="Duration (s)"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#durationPacingGradient)"
                      activeDot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-2 font-mono-code">
                <span>Fastest: {timingStats.min}s</span>
                <span>Median: {timingStats.median}s</span>
                <span>Slowest: {timingStats.max}s</span>
              </div>
            </div>

            {/* Session Conversion Donut */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-between">
              <div className="w-full text-left mb-1">
                <h3 className="text-sm font-bold text-slate-900">Conversion Ratio</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completed submissions vs drop-offs.
                </p>
              </div>

              <div className="relative w-40 h-40 my-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`overview-donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-900">{completionStats.rate}%</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-code">
                    Completed
                  </span>
                </div>
              </div>

              <div className="w-full space-y-1.5 pt-3 border-t border-slate-100 font-mono-code text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                    <span>Completed</span>
                  </div>
                  <span className="font-semibold">{completionStats.completions}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                    <span>Abandoned</span>
                  </div>
                  <span className="font-semibold">{completionStats.dropOffCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Trends Over Time (Deep Dive into Chronological Submission Progression) */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Main Trend Composed Chart: Cumulative Submissions and Individual Response Times */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Response Volume & Pacing Timeline
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-blue-50 text-blue-700 font-medium">
                    {currentSelectedForm.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plots the cumulative response trajectory alongside individual completion durations (seconds) across submissions.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono-code text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
                  Cumulative Total
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                  Duration (s)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
                  Rolling Avg
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={responseTimelineData}
                  margin={{ top: 12, right: 16, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trendsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                  />
                  {/* Left Y Axis: Cumulative volume */}
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tick={{ fontSize: 11, fill: '#4F46E5', fontFamily: 'monospace' }}
                  />
                  {/* Right Y Axis: Duration in seconds */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    unit="s"
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tick={{ fontSize: 11, fill: '#2563EB', fontFamily: 'monospace' }}
                  />
                  <Tooltip content={<CustomComposedTrendTooltip />} />
                  <ReferenceLine
                    yAxisId="right"
                    y={timingStats.avg}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Overall Avg: ${timingStats.avg}s`,
                      position: 'insideTopRight',
                      fill: '#D97706',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative Responses"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#trendsAreaGradient)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="duration"
                    name="Duration (s)"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rollingAvg"
                    name="Rolling Avg (s)"
                    stroke="#F59E0B"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-100 mt-2 font-mono-code text-xs text-slate-500">
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Total Submissions</span>
                <span className="font-bold text-slate-900 text-sm">{responseTimelineData.length}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">First Recorded</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {responseTimelineData[0]?.timeLabel || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Most Recent</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {responseTimelineData[responseTimelineData.length - 1]?.timeLabel || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-400">Average Pacing</span>
                <span className="font-bold text-blue-600 text-sm">{timingStats.avg}s</span>
              </div>
            </div>
          </div>

          {/* Chronological Submission Event Stream Log */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chronological Submission Timeline Stream
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordered event trail of respondent submissions from earliest to latest.
                </p>
              </div>
              <span className="text-xs font-mono-code text-slate-500">
                {responseTimelineData.length} timeline events
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {responseTimelineData.map((item) => {
                const diff = item.duration - timingStats.avg;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs font-mono-code"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                        {item.cumulative}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900">{item.title}</span>
                        <span className="text-slate-400 ml-2">ID: {item.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">{item.timeLabel}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-800 font-semibold">
                        {item.duration}s
                      </span>
                      <span
                        className={`text-[11px] ${
                          diff < 0
                            ? 'text-emerald-600'
                            : diff > 0
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {diff < 0 ? `${Math.abs(diff)}s faster` : diff > 0 ? `+${diff}s slower` : 'exact avg'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Completion Rate Deep Dive */}
      {activeTab === 'completion' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart of Overall Completion vs Drop-off */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-between">
              <div className="w-full text-left mb-2">
                <h3 className="text-sm font-bold text-slate-900">Session Conversion</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Started sessions vs verified completed submissions.
                </p>
              </div>

              <div className="relative w-48 h-48 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-900">{completionStats.rate}%</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-code">
                    Completed
                  </span>
                </div>
              </div>

              <div className="w-full space-y-2 pt-3 border-t border-slate-100 font-mono-code text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                    <span>Completed Submissions</span>
                  </div>
                  <span className="font-semibold">{completionStats.completions}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                    <span>Incomplete / Abandoned</span>
                  </div>
                  <span className="font-semibold">{completionStats.dropOffCount}</span>
                </div>
              </div>
            </div>

            {/* Detailed Question Completion Funnel with Horizontal Bars */}
            <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Question-Level Drop-off & Completion Rate
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Step-by-step conversion and friction points across {currentSelectedForm.title}.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Average retention: {Math.round(questionFunnelData.reduce((a, b) => a + b.rate, 0) / (questionFunnelData.length || 1))}%
                </span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={questionFunnelData}
                    layout="vertical"
                    margin={{ top: 8, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      dataKey="shortLabel"
                      type="category"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#4F46E5', fontWeight: 600, fontFamily: 'monospace' }}
                      width={30}
                    />
                    <Tooltip content={<CustomCompletionTooltip />} />
                    <Bar
                      dataKey="rate"
                      name="Completion %"
                      fill="#4F46E5"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    >
                      {questionFunnelData.map((entry, index) => (
                        <Cell
                          key={`v-cell-${index}`}
                          fill={entry.rate >= 95 ? '#4F46E5' : entry.rate >= 80 ? '#475569' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Step Key Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2">
                {questionFunnelData.map((q) => (
                  <div key={q.stepNumber} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate pr-2 font-mono-code text-slate-500">
                      <strong className="text-slate-900">{q.stepNumber}:</strong> {q.fullTitle}
                    </span>
                    <span className="font-mono-code font-semibold text-slate-900 shrink-0">
                      {q.rate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form-by-Form Completion Rate Comparison */}
          {availableForms.length > 1 && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Completion Rate Across Available Forms
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Benchmark conversion consistency across different form structures.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-slate-400">
                  {availableForms.length} Forms
                </span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={formComparisonData}
                    margin={{ top: 12, right: 16, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="formName"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomFormComparisonTooltip />} />
                    <ReferenceLine
                      y={80}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      label={{
                        value: '80% Target',
                        position: 'insideTopRight',
                        fill: '#059669',
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    />
                    <Bar
                      dataKey="completionRate"
                      name="Completion Rate (%)"
                      fill="#4F46E5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    >
                      {formComparisonData.map((entry, index) => (
                        <Cell
                          key={`form-bar-${index}`}
                          fill={entry.isActive ? '#4F46E5' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Response Timing Deep Dive */}
      {activeTab === 'timing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Detailed Submission Duration Timeline */}
            <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Individual Submission Response Time Timeline
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Duration in seconds with continuous benchmark average line.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono-code bg-amber-50 text-amber-800 border border-amber-200">
                  Target: ~45–60s
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={responseTimelineData}
                    margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="timingGradientFull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      unit="s"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomTimingTooltip avgTime={timingStats.avg} />} />
                    <ReferenceLine
                      y={timingStats.avg}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Avg ${timingStats.avg}s`,
                        position: 'insideTopLeft',
                        fill: '#DC2626',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="duration"
                      name="Duration (s)"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#timingGradientFull)"
                      activeDot={{ r: 5, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 font-mono-code">
                <span>Fastest: {timingStats.min}s</span>
                <span>Median: {timingStats.median}s</span>
                <span>Average: {timingStats.avg}s</span>
                <span>Maximum: {timingStats.max}s</span>
              </div>
            </div>

            {/* Pacing Distribution Histogram */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900">Pacing Distribution</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grouping completions into response duration tiers.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pacingDistributionData}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="range"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomPacingTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Responses"
                      fill="#4F46E5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    >
                      {pacingDistributionData.map((entry, index) => (
                        <Cell
                          key={`pacing-${index}`}
                          fill={index === 1 ? '#4F46E5' : index === 0 ? '#10B981' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t border-slate-100 font-mono-code text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  Dominant: {dominantPacingBucket.count > 0 ? `${dominantPacingBucket.label} (${dominantPacingBucket.range})` : 'N/A'}
                </span>
                <span className="text-emerald-600 font-medium">
                  {dominantPacingBucket.count > 0
                    ? `${Math.round((dominantPacingBucket.count / filteredSubmissions.length) * 100)}% of responses`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Form-by-Form Average Duration Comparison */}
          {availableForms.length > 1 && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Average Duration by Form
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compare average completion times across different conversational forms.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-slate-400">
                  {availableForms.length} Forms
                </span>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={formComparisonData}
                    margin={{ top: 12, right: 16, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="formName"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <YAxis
                      unit="s"
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                    />
                    <Tooltip content={<CustomFormDurationTooltip overallAvg={timingStats.avg} />} />
                    <ReferenceLine
                      y={timingStats.avg}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      label={{
                        value: `Overall ${timingStats.avg}s`,
                        position: 'insideTopRight',
                        fill: '#D97706',
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    />
                    <Bar
                      dataKey="avgDuration"
                      name="Avg Duration (s)"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    >
                      {formComparisonData.map((entry, index) => (
                        <Cell
                          key={`dur-bar-${index}`}
                          fill={entry.isActive ? '#2563EB' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Custom Tooltip for Response Trend Over Time
const CustomTrendTooltip = ({ active, payload, avgTime }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const diff = data.duration - avgTime;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-900 mb-1">{data.title}</div>
        <div className="text-slate-500 font-mono-code mb-2 text-[11px]">
          Cumulative Response #{data.cumulative} · {data.timeLabel}
        </div>
        <div className="space-y-1 font-mono-code">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">Total Progress:</span>
            <span className="font-bold text-slate-900">{data.cumulative} responses</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">Completion Duration:</span>
            <span className="font-bold text-blue-600">{data.duration} seconds</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-500">
            <span>Vs. Average ({avgTime}s):</span>
            <span
              className={`font-semibold ${
                diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-600'
              }`}
            >
              {diff > 0 ? `+${diff}s slower` : diff < 0 ? `${Math.abs(diff)}s faster` : 'Exact avg'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Composed Trend Over Time
const CustomComposedTrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-900 mb-0.5">{data.title}</div>
        <div className="text-slate-500 font-mono-code mb-2 text-[11px]">
          Response #{data.cumulative} · Submitted {data.timeLabel}
        </div>
        <div className="space-y-1 font-mono-code text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">Cumulative Volume:</span>
            <span className="font-bold text-slate-900">{data.cumulative}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">Response Duration:</span>
            <span className="font-bold text-blue-600">{data.duration}s</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Rolling Avg Duration:</span>
            <span className="font-bold text-amber-600">{data.rollingAvg}s</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Timing Trend
const CustomTimingTooltip = ({ active, payload, avgTime }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const diff = data.duration - avgTime;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-900 mb-1">{data.title}</div>
        <div className="text-slate-500 font-mono-code mb-2 text-[11px]">
          Response {data.seq} · Submitted {data.timeLabel}
        </div>
        <div className="flex items-center justify-between gap-4 font-mono-code">
          <span className="text-slate-600">Completion Duration:</span>
          <span className="font-bold text-slate-900">{data.duration} seconds</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-mono-code mt-1">
          <span className="text-slate-500">Vs. Average ({avgTime}s):</span>
          <span
            className={`font-semibold ${
              diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-600'
            }`}
          >
            {diff > 0 ? `+${diff}s slower` : diff < 0 ? `${Math.abs(diff)}s faster` : 'Exact average'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Question Completion Funnel
const CustomCompletionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans max-w-xs">
        <div className="font-mono-code text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
          {data.stepNumber} · Type: {data.type}
        </div>
        <div className="font-semibold text-slate-900 mb-2">{data.fullTitle}</div>
        <div className="flex items-center justify-between gap-4 font-mono-code">
          <span className="text-slate-600">Completion Rate:</span>
          <span className="font-bold text-emerald-600 text-sm">{data.rate}%</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-mono-code text-slate-500 mt-1">
          <span>Responses Recorded:</span>
          <span>
            {data.answeredCount} of {data.totalCount}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Donut Pie
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-md text-xs font-mono-code">
        <div className="font-semibold text-slate-900">{data.name}</div>
        <div className="text-slate-600 mt-0.5">
          Count: <strong className="text-slate-900">{data.value}</strong>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Pacing Distribution
const CustomPacingTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-md text-xs font-mono-code">
        <div className="font-semibold text-slate-900">{data.range} ({data.label})</div>
        <div className="text-slate-600 mt-0.5">
          Submissions: <strong className="text-slate-900">{data.count}</strong>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Form Comparison
const CustomFormComparisonTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-900 mb-1">{data.fullName}</div>
        <div className="flex items-center justify-between gap-4 font-mono-code">
          <span className="text-slate-600">Completion Rate:</span>
          <span className="font-bold text-emerald-600">{data.completionRate}%</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-mono-code text-slate-500 mt-1">
          <span>Completed / Started:</span>
          <span>{data.completions} / {data.starts}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Form Duration
const CustomFormDurationTooltip = ({ active, payload, overallAvg }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const diff = data.avgDuration - overallAvg;
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-900 mb-1">{data.fullName}</div>
        <div className="flex items-center justify-between gap-4 font-mono-code">
          <span className="text-slate-600">Average Response Time:</span>
          <span className="font-bold text-blue-600">{data.avgDuration} seconds</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-mono-code text-slate-500 mt-1">
          <span>Vs. Overall Avg:</span>
          <span className={diff > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
            {diff > 0 ? `+${diff}s longer` : `${Math.abs(diff)}s faster`}
          </span>
        </div>
      </div>
    );
  }
  return null;
};
