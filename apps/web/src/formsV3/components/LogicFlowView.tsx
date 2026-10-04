import React, { useState, useMemo } from 'react';
import { motion } from '../lib/motion';
import {
  GitBranch,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Play,
  Settings2,
  Plus,
  Eye,
  Sliders,
  Check,
  Star,
  ListOrdered,
  Calendar,
  ToggleLeft,
  Upload,
  Globe,
  Mail,
  Hash,
  FileText,
  Building,
  ChevronRight,
  ExternalLink,
  Split,
  Workflow,
  Compass,
} from 'lucide-react';
import type { FormConfig, FormStep, LogicRule, QuestionType } from '../types';
import { OPERATOR_LABELS, checkRuleMatch } from '../utils/logicUtils';

interface LogicFlowViewProps {
  form: FormConfig;
  selectedStepId: string;
  onSelectStep: (stepId: string) => void;
  onOpenLogicTab: (stepId: string) => void;
  onLaunchLiveDemo?: () => void;
  onClose?: () => void;
}

export const LogicFlowView: React.FC<LogicFlowViewProps> = ({
  form,
  selectedStepId,
  onSelectStep,
  onOpenLogicTab,
  onLaunchLiveDemo,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isDetailed, setIsDetailed] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'all' | 'branches_only'>('all');
  const [testAnswers, setTestAnswers] = useState<Record<string, any>>({});
  const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);

  // Analyze conditional logic across form
  const logicStats = useMemo(() => {
    let stepsWithLogic = 0;
    let totalRules = 0;
    const branchMap: Record<string, { rules: LogicRule[]; defaultJump?: string }> = {};

    form.steps.forEach((step) => {
      if (step.logic && step.logic.enabled) {
        const rules = step.logic.rules || [];
        if (rules.length > 0 || (step.logic.defaultJumpToStepId && step.logic.defaultJumpToStepId !== 'next')) {
          stepsWithLogic++;
          totalRules += rules.length;
          branchMap[step.id] = {
            rules,
            defaultJump: step.logic.defaultJumpToStepId,
          };
        }
      }
    });

    return {
      stepsWithLogic,
      totalRules,
      hasLogic: stepsWithLogic > 0,
      branchMap,
    };
  }, [form.steps]);

  // Find step by ID helper
  const getStepById = (id: string): FormStep | undefined => {
    return form.steps.find((s) => s.id === id);
  };

  const getStepIndex = (id: string): number => {
    return form.steps.findIndex((s) => s.id === id);
  };

  // Helper for question type icon
  const renderTypeIcon = (type: QuestionType, className = 'w-3.5 h-3.5') => {
    switch (type) {
      case 'welcome':
        return <Sparkles className={className} />;
      case 'short_text':
      case 'long_text':
        return <FileText className={className} />;
      case 'multiple_choice':
        return <ListOrdered className={className} />;
      case 'dropdown':
        return <ListOrdered className={className} />;
      case 'email':
        return <Mail className={className} />;
      case 'phone':
        return <Hash className={className} />;
      case 'number':
        return <Hash className={className} />;
      case 'rating':
        return <Star className={className} />;
      case 'opinion_scale':
        return <Sliders className={className} />;
      case 'yes_no':
        return <ToggleLeft className={className} />;
      case 'date':
        return <Calendar className={className} />;
      case 'file_upload':
        return <Upload className={className} />;
      case 'website':
        return <Globe className={className} />;
      case 'thank_you':
        return <CheckCircle2 className={className} />;
      default:
        return <HelpCircle className={className} />;
    }
  };

  // Evaluate branching for interactive rule test
  const getBranchTestTarget = (step: FormStep): { targetStepId: string | null; ruleId: string | null } => {
    if (!step.logic || !step.logic.enabled) return { targetStepId: null, ruleId: null };
    const answer = testAnswers[step.id];
    if (answer === undefined || answer === '') return { targetStepId: null, ruleId: null };

    const rules = step.logic.rules || [];
    for (const r of rules) {
      if (r.jumpToStepId && checkRuleMatch(r, answer)) {
        return { targetStepId: r.jumpToStepId, ruleId: r.id };
      }
    }
    if (step.logic.defaultJumpToStepId && step.logic.defaultJumpToStepId !== 'next') {
      return { targetStepId: step.logic.defaultJumpToStepId, ruleId: 'default' };
    }
    return { targetStepId: null, ruleId: null };
  };

  // Determine which steps to display based on filter
  const displayedSteps = useMemo(() => {
    if (filterMode === 'all') return form.steps;
    return form.steps.filter((step, idx) => {
      const hasOutgoing = step.logic?.enabled && (step.logic.rules?.length || 0) > 0;
      const isTarget = form.steps.some(
        (s) => s.logic?.enabled && s.logic.rules?.some((r) => r.jumpToStepId === step.id)
      );
      return hasOutgoing || isTarget || idx === 0 || step.type === 'thank_you';
    });
  }, [form.steps, filterMode]);

  return (
    <div className="h-full flex flex-col bg-slate-50/70 text-slate-900 select-none overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-slate-200/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/20">
            <GitBranch className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm font-bold text-sm text-slate-900 tracking-tight">
                Logic Flow Diagram
              </h3>
              {logicStats.hasLogic ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Split className="w-3 h-3 text-emerald-600" />
                  {logicStats.totalRules} {logicStats.totalRules === 1 ? 'Rule' : 'Rules'} Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code bg-slate-100 text-slate-600 border border-slate-200">
                  Sequential (Linear)
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs truncate max-w-md">
              {logicStats.hasLogic
                ? `${logicStats.stepsWithLogic} decision ${
                    logicStats.stepsWithLogic === 1 ? 'step' : 'steps'
                  } dynamically routing respondents based on answers.`
                : 'Steps advance consecutively 1 → 2 → 3. Add conditions in the Logic tab to create branches.'}
            </p>
          </div>
        </div>

        {/* Action and Display Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter Mode Toggle */}
          {logicStats.hasLogic && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Steps ({form.steps.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('branches_only')}
                className={`px-2.5 py-1 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                  filterMode === 'branches_only'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Branches Only
              </button>
            </div>
          )}

          {/* Detailed Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsDetailed((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
              isDetailed
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle compact or detailed card view"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isDetailed ? 'Detailed' : 'Compact'}</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono-code font-semibold px-2 text-slate-700 min-w-[42px] text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 border-l border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {onLaunchLiveDemo && (
            <button
              type="button"
              onClick={onLaunchLiveDemo}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <Play className="w-3 h-3 text-emerald-400" />
              <span>Test Live</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              title="Close logic visualization"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Diagram Canvas */}
      <div className="flex-1 overflow-auto p-6 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
        {/* If form has NO conditional logic, show educational prompt */}
        {!logicStats.hasLogic && (
          <div className="max-w-xl mx-auto mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-950 text-sm">
                  This form is currently running sequentially
                </p>
                <p className="text-amber-800/90 mt-1 leading-relaxed">
                  Every respondent sees the exact same steps in numerical order. You can add smart
                  branching rules (e.g. <em>"If score &lt; 3, ask for suggestions"</em> or{' '}
                  <em>"If Enterprise, route to priority calendar"</em>) in the Logic tab.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenLogicTab(selectedStepId)}
                    className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Logic Rule to Current Step</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tree Diagram Container Scaled by Zoom */}
        <div
          className="mx-auto transition-transform duration-150 origin-top flex flex-col items-center gap-6"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {/* Start / Root Node */}
          <div className="flex flex-col items-center">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-mono-code font-bold flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>START OF FLOW</span>
            </div>
            <div className="w-0.5 h-6 bg-slate-300 my-0.5" />
          </div>

          {/* Steps Sequence / Branching Cards */}
          <div className="w-full max-w-3xl space-y-6">
            {displayedSteps.map((step, idx) => {
              const originalIndex = getStepIndex(step.id);
              const isSelected = step.id === selectedStepId;
              const hasLogic = Boolean(step.logic?.enabled);
              const rules = step.logic?.rules || [];
              const hasRules = rules.length > 0;
              const nextStep = form.steps[originalIndex + 1];
              const defaultJumpId = step.logic?.defaultJumpToStepId;

              // Rule test evaluation result
              const simResult = getBranchTestTarget(step);

              return (
                <div
                  key={step.id}
                  id={`logic-node-${step.id}`}
                  className="relative group"
                  onMouseEnter={() => setHoveredStepId(step.id)}
                  onMouseLeave={() => setHoveredStepId(null)}
                >
                  {/* Step Card */}
                  <div
                    onClick={() => onSelectStep(step.id)}
                    className={`rounded-2xl border bg-white transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/15'
                        : hasLogic
                        ? 'border-emerald-300/80 hover:border-emerald-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Step Card Header */}
                    <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Step Number Badge */}
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-mono-code text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-600'
                              : hasLogic
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {originalIndex + 1}
                        </span>

                        {/* Question Type Pill */}
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium shrink-0">
                          {renderTypeIcon(step.type)}
                          <span className="capitalize">{step.type.replace('_', ' ')}</span>
                        </span>

                        {step.validation?.required && (
                          <span className="text-[10px] text-rose-600 font-semibold px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 shrink-0">
                            Required
                          </span>
                        )}

                        {isSelected && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full shrink-0 border border-indigo-600">
                            Editing in Builder
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasLogic && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono-code font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <GitBranch className="w-3 h-3 text-emerald-600" />
                            {rules.length} {rules.length === 1 ? 'Rule' : 'Rules'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLogicTab(step.id);
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                          title="Open logic settings for this step"
                        >
                          <Settings2 className="w-3 h-3 text-slate-500" />
                          <span>Configure</span>
                        </button>
                      </div>
                    </div>

                    {/* Step Title & Details */}
                    <div className="p-4">
                      <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                        {step.title || 'Untitled Step'}
                      </h4>

                      {isDetailed && step.description && (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                          {step.description}
                        </p>
                      )}

                      {/* Display options preview if multiple choice */}
                      {isDetailed && step.options && step.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {step.options.map((opt) => (
                            <span
                              key={opt.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600"
                            >
                              <span className="font-mono-code text-[10px] text-slate-400">
                                {opt.keyHint || '•'}
                              </span>
                              <span>{opt.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Conditional Logic Branching Decision Block */}
                    {hasLogic && (
                      <div className="bg-emerald-50/50 border-t border-emerald-100 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs text-emerald-900 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Split className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Decision Rules (Branching Split)</span>
                          </span>
                          <span className="text-[10px] font-normal text-emerald-700">
                            Evaluated in top-to-bottom order
                          </span>
                        </div>

                        {/* Rules List */}
                        <div className="space-y-2">
                          {rules.map((rule, rIdx) => {
                            const targetStep = getStepById(rule.jumpToStepId);
                            const targetIdx = targetStep ? getStepIndex(targetStep.id) : -1;
                            const isMatched = simResult.ruleId === rule.id;

                            return (
                              <div
                                key={rule.id}
                                onMouseEnter={() => setHoveredRuleId(rule.id)}
                                onMouseLeave={() => setHoveredRuleId(null)}
                                className={`p-2.5 rounded-xl border text-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                  isMatched
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                    : 'bg-white border-emerald-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                                      isMatched
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    IF #{rIdx + 1}
                                  </span>
                                  <span className="truncate">
                                    <strong>Answer</strong>{' '}
                                    <span className={isMatched ? 'text-emerald-100' : 'text-slate-600'}>
                                      {OPERATOR_LABELS[rule.operator] || rule.operator}
                                    </span>{' '}
                                    {rule.value !== undefined && rule.value !== '' && (
                                      <code
                                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono-code font-bold ${
                                          isMatched
                                            ? 'bg-emerald-700 text-white'
                                            : 'bg-slate-100 text-slate-900'
                                        }`}
                                      >
                                        "{String(rule.value)}"
                                      </code>
                                    )}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (targetStep) onSelectStep(targetStep.id);
                                    }}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                                      isMatched
                                        ? 'bg-white text-emerald-900'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    }`}
                                  >
                                    <span>
                                      {targetStep
                                        ? `Step ${targetIdx + 1}: ${targetStep.title.slice(0, 20)}...`
                                        : rule.jumpToStepId === 'thank_you' || rule.jumpToStepId === 'submit'
                                        ? 'Thank You (Submit)'
                                        : rule.jumpToStepId}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Default Fallback */}
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono-code uppercase text-slate-400 font-bold">
                                OTHERWISE:
                              </span>
                              <span>
                                {defaultJumpId && defaultJumpId !== 'next'
                                  ? `Jump to ${
                                      getStepById(defaultJumpId)?.title || defaultJumpId
                                    }`
                                  : nextStep
                                  ? `Proceed to Step ${originalIndex + 2} (${nextStep.title.slice(
                                      0,
                                      24
                                    )}...)`
                                  : 'Proceed to Thank You Screen'}
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono-code">Default</span>
                          </div>
                        </div>

                        {/* Mini Interactive Simulation Bar */}
                        <div className="pt-2 border-t border-emerald-200/60 flex items-center gap-2 text-xs">
                          <span className="text-[11px] font-semibold text-emerald-900 shrink-0">
                            Test Rule:
                          </span>
                          <input
                            type="text"
                            value={testAnswers[step.id] || ''}
                            onChange={(e) =>
                              setTestAnswers((prev) => ({
                                ...prev,
                                [step.id]: e.target.value,
                              }))
                            }
                            placeholder="Type test answer (e.g. 2, Yes, Enterprise)..."
                            className="flex-1 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                          />
                          {simResult.targetStepId && (
                            <span className="text-[11px] font-mono-code font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md shrink-0">
                              ➔ Jumps to{' '}
                              {getStepById(simResult.targetStepId)
                                ? `Step ${getStepIndex(simResult.targetStepId) + 1}`
                                : simResult.targetStepId}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Connecting Flow Arrow to Next / Below */}
                  {idx < displayedSteps.length - 1 && (
                    <div className="flex flex-col items-center my-2">
                      <div className="w-0.5 h-6 bg-slate-300" />
                      <div className="w-2 h-2 border-b-2 border-r-2 border-slate-400 rotate-45 -mt-1" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* End / Completion Node */}
          <div className="flex flex-col items-center mt-2">
            <div className="w-0.5 h-6 bg-slate-300" />
            <div className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 shadow-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>FLOW COMPLETE · SUBMISSION CAPTURED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <span>
            Total Steps: <strong>{form.steps.length}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Branching Points:{' '}
            <strong className="text-emerald-700">{logicStats.stepsWithLogic}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Conditional Rules: <strong>{logicStats.totalRules}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">
            Click any step card to select & edit in builder
          </span>
        </div>
      </div>
    </div>
  );
};
