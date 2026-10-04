import React from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CornerDownRight,
  CheckCircle2,
  Workflow,
} from 'lucide-react';
import type { FormConfig, FormStep, LogicConditionOperator, LogicRule, StepLogic } from '../types';
import { OPERATOR_LABELS, getOperatorsForType } from '../utils/logicUtils';

interface LogicBranchingEditorProps {
  currentStep: FormStep;
  form: FormConfig;
  onUpdateStep: (updatedFields: Partial<FormStep>) => void;
  onOpenFlowVisualization?: () => void;
}

export const LogicBranchingEditor: React.FC<LogicBranchingEditorProps> = ({
  currentStep,
  form,
  onUpdateStep,
  onOpenFlowVisualization,
}) => {
  const logic: StepLogic = currentStep.logic || {
    enabled: false,
    defaultJumpToStepId: 'next',
    rules: [],
  };

  const isEnabled = Boolean(logic.enabled);
  const rules = logic.rules || [];

  // Available jump targets: all other steps in the form
  const availableTargets = form.steps.filter((s) => s.id !== currentStep.id);

  const handleToggleEnabled = () => {
    if (!isEnabled) {
      // Enable logic and add a default starter rule if none exist
      const starterRule: LogicRule = {
        id: 'rule-' + Date.now(),
        operator: currentStep.type === 'multiple_choice' ? 'equals' : 'equals',
        value: currentStep.options?.[0]?.label || '',
        jumpToStepId: availableTargets[0]?.id || 'thank_you',
      };

      onUpdateStep({
        logic: {
          enabled: true,
          defaultJumpToStepId: 'next',
          rules: rules.length > 0 ? rules : [starterRule],
        },
      });
    } else {
      onUpdateStep({
        logic: {
          ...logic,
          enabled: false,
        },
      });
    }
  };

  const handleAddRule = () => {
    const newRule: LogicRule = {
      id: 'rule-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      operator: 'equals',
      value: currentStep.options?.[0]?.label || '',
      jumpToStepId: availableTargets[0]?.id || 'thank_you',
    };

    onUpdateStep({
      logic: {
        ...logic,
        enabled: true,
        rules: [...rules, newRule],
      },
    });
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<LogicRule>) => {
    const updatedRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r));
    onUpdateStep({
      logic: {
        ...logic,
        rules: updatedRules,
      },
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = rules.filter((r) => r.id !== ruleId);
    onUpdateStep({
      logic: {
        ...logic,
        rules: updatedRules,
      },
    });
  };

  const handleUpdateDefaultJump = (defaultJumpToStepId: string) => {
    onUpdateStep({
      logic: {
        ...logic,
        defaultJumpToStepId,
      },
    });
  };

  const allowedOperators = getOperatorsForType(currentStep.type);

  // If this is a thank you screen, branching doesn't apply
  if (currentStep.type === 'thank_you') {
    return (
      <div className="p-5 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
          <Workflow className="w-5 h-5 text-slate-500" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-900">Final Screen</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            This is the completion / submission screen. Branching logic routes respondents TO this
            screen, but does not route forward from it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header card with toggle */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
            >
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline-sm text-xs font-bold text-slate-900">Conditional Branching Logic</h3>
              <p className="text-[11px] text-slate-500">
                Skip or route to specific questions based on answers
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={handleToggleEnabled}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {!isEnabled ? (
          <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600 leading-relaxed">
            <p className="mb-2.5">
              By default, respondents simply move to the next sequential question. Enable branching to
              create personalized survey paths, skip irrelevant questions, or fast-track users to the
              completion screen.
            </p>
            <button
              type="button"
              onClick={handleToggleEnabled}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enable Branching on this Question</span>
            </button>
          </div>
        ) : (
          <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Logic active ({rules.length} rule{rules.length === 1 ? '' : 's'})</span>
            </span>

            {onOpenFlowVisualization && (
              <button
                type="button"
                onClick={onOpenFlowVisualization}
                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                title="Visualize entire branching tree diagram"
              >
                <GitBranch className="w-3 h-3 text-emerald-400" />
                <span>View Logic Flow</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isEnabled && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono-code">
                Branching Rules
              </span>
              <span className="text-[11px] text-slate-400">Evaluated in top-to-bottom order</span>
            </div>

            {rules.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2 bg-white">
                <p className="text-xs text-slate-500">No branching rules defined yet.</p>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Rule</span>
                </button>
              </div>
            ) : (
              rules.map((rule, idx) => {
                const needsValue = rule.operator !== 'is_answered' && rule.operator !== 'is_empty';

                return (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3 group hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-code font-bold text-slate-500">
                        <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700">
                          {idx + 1}
                        </span>
                        <span>IF ANSWER</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                        title="Remove rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Condition operator + value */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Condition
                        </label>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              operator: e.target.value as LogicConditionOperator,
                            })
                          }
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 cursor-pointer"
                        >
                          {allowedOperators.map((op) => (
                            <option key={op} value={op}>
                              {OPERATOR_LABELS[op]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {needsValue && (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                            Target Value
                          </label>
                          {currentStep.type === 'multiple_choice' &&
                            (currentStep.options || []).length > 0 ? (
                            <select
                              value={String(rule.value ?? '')}
                              onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 cursor-pointer"
                            >
                              <option value="" disabled>
                                Select option...
                              </option>
                              {(currentStep.options || []).map((opt) => (
                                <option key={opt.id} value={opt.label}>
                                  {opt.keyHint ? `[${opt.keyHint}] ` : ''}
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : currentStep.type === 'rating' ? (
                            <select
                              value={String(rule.value ?? 1)}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, { value: Number(e.target.value) })
                              }
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 cursor-pointer"
                            >
                              {Array.from(
                                { length: currentStep.ratingMax || 5 },
                                (_, i) => i + 1
                              ).map((num) => (
                                <option key={num} value={num}>
                                  Score {num}
                                </option>
                              ))}
                            </select>
                          ) : currentStep.type === 'opinion_scale' ? (
                            <input
                              type="number"
                              min="0"
                              max={currentStep.scaleMax || 10}
                              value={rule.value ?? 5}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, { value: Number(e.target.value) })
                              }
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
                              placeholder="Score number"
                            />
                          ) : (
                            <input
                              type="text"
                              value={String(rule.value ?? '')}
                              onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
                              placeholder="Enter value to match..."
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Destination Action */}
                    <div className="pt-1.5 border-t border-slate-100 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono-code font-bold text-slate-600 shrink-0">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span>THEN JUMP TO:</span>
                      </div>
                      <select
                        value={rule.jumpToStepId}
                        onChange={(e) =>
                          handleUpdateRule(rule.id, { jumpToStepId: e.target.value })
                        }
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 cursor-pointer font-medium text-slate-800 truncate"
                      >
                        {availableTargets.map((target, tIdx) => {
                          const originalIdx = form.steps.findIndex((s) => s.id === target.id);
                          return (
                            <option key={target.id} value={target.id}>
                              Step {originalIdx + 1}: {target.title || target.type}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add another rule button */}
            <button
              type="button"
              onClick={handleAddRule}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Add Another Condition Rule</span>
            </button>
          </div>

          {/* Fallback / Otherwise Destination */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
              <span>Otherwise (Default Fallback)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              If none of the conditional rules match above, where should the respondent be routed?
            </p>

            <select
              value={logic.defaultJumpToStepId || 'next'}
              onChange={(e) => handleUpdateDefaultJump(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 cursor-pointer font-medium text-slate-800"
            >
              <option value="next">Default: Proceed to next sequential question</option>
              {availableTargets.map((target) => {
                const originalIdx = form.steps.findIndex((s) => s.id === target.id);
                return (
                  <option key={target.id} value={target.id}>
                    Jump to Step {originalIdx + 1}: {target.title || target.type}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
