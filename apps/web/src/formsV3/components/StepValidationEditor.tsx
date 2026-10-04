import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Sliders,
  Type,
  Hash,
  FileCode2,
  Check,
  RotateCcw,
  Eye,
  Info,
} from 'lucide-react';
import type { FormStep, RegexPresetId, ValidationRule } from '../types';
import { REGEX_PRESETS, testRegexPattern } from '../utils/validationUtils';

interface StepValidationEditorProps {
  currentStep: FormStep;
  onUpdateStep: (updatedFields: Partial<FormStep>) => void;
}

export const StepValidationEditor: React.FC<StepValidationEditorProps> = ({
  currentStep,
  onUpdateStep,
}) => {
  const validation: ValidationRule = currentStep.validation || {};

  // Interactive Regex Sandbox Test Value
  const [testValue, setTestValue] = useState<string>('');

  // Selected Preset
  const currentPresetId: RegexPresetId = validation.patternPreset || (validation.pattern ? 'custom' : 'none');

  const activePreset = useMemo(() => {
    return REGEX_PRESETS.find((p) => p.id === currentPresetId) || REGEX_PRESETS[0];
  }, [currentPresetId]);

  // Safe updates to validation object
  const updateValidation = (updates: Partial<ValidationRule>) => {
    onUpdateStep({
      validation: {
        ...currentStep.validation,
        ...updates,
      },
    });
  };

  // Test regex in live sandbox
  const regexTestResult = useMemo(() => {
    if (!validation.pattern || !validation.pattern.trim()) {
      return { tested: false, isValid: true };
    }
    if (!testValue) {
      return { tested: false, isValid: true };
    }
    const res = testRegexPattern(validation.pattern, validation.patternFlags || '', testValue);
    return {
      tested: true,
      isValid: res.isValid,
      compileError: res.compileError,
    };
  }, [validation.pattern, validation.patternFlags, testValue]);

  // Handle choosing a preset
  const handleSelectPreset = (presetId: RegexPresetId) => {
    if (presetId === 'none') {
      updateValidation({
        patternPreset: 'none',
        pattern: '',
        patternFlags: '',
        patternDescription: '',
        customPatternMessage: '',
      });
      setTestValue('');
      return;
    }

    if (presetId === 'custom') {
      updateValidation({
        patternPreset: 'custom',
        pattern: validation.pattern || '^[a-zA-Z0-9_-]+$',
        patternFlags: validation.patternFlags || '',
        patternDescription: 'Custom regular expression',
      });
      return;
    }

    const found = REGEX_PRESETS.find((p) => p.id === presetId);
    if (found) {
      updateValidation({
        patternPreset: found.id,
        pattern: found.pattern,
        patternFlags: found.flags || '',
        patternDescription: found.description,
        customPatternMessage: validation.customPatternMessage || found.defaultError,
      });
      setTestValue(found.example);
    }
  };

  // Quick preset shortcuts
  const quickTemplates = [
    {
      label: 'Strict Business Email',
      apply: () => {
        const p = REGEX_PRESETS.find((x) => x.id === 'email_corporate')!;
        updateValidation({
          required: true,
          patternPreset: 'email_corporate',
          pattern: p.pattern,
          patternFlags: p.flags,
          patternDescription: p.description,
          customPatternMessage: p.defaultError,
          customRequiredMessage: 'Work or corporate email is required.',
        });
        setTestValue('sarah@company.com');
      },
    },
    {
      label: 'US Phone (10 Digits)',
      apply: () => {
        const p = REGEX_PRESETS.find((x) => x.id === 'phone_us')!;
        updateValidation({
          required: true,
          patternPreset: 'phone_us',
          pattern: p.pattern,
          patternFlags: p.flags,
          patternDescription: p.description,
          customPatternMessage: p.defaultError,
          customRequiredMessage: 'Please provide your primary contact phone number.',
        });
        setTestValue('(415) 555-0199');
      },
    },
    {
      label: 'Bio / Note (20 - 300 chars)',
      apply: () => {
        updateValidation({
          required: true,
          minLength: 20,
          maxLength: 300,
          showCharCount: true,
          customMinLengthMessage: 'Please write at least 20 characters for your bio.',
          customMaxLengthMessage: 'Please keep your answer within 300 characters.',
        });
      },
    },
    {
      label: 'Clean URL Slug',
      apply: () => {
        const p = REGEX_PRESETS.find((x) => x.id === 'slug')!;
        updateValidation({
          required: true,
          patternPreset: 'slug',
          pattern: p.pattern,
          patternDescription: p.description,
          customPatternMessage: p.defaultError,
          disallowSpaces: true,
        });
        setTestValue('my-product-launch');
      },
    },
  ];

  const isTextType =
    currentStep.type === 'short_text' ||
    currentStep.type === 'long_text' ||
    currentStep.type === 'email' ||
    currentStep.type === 'phone' ||
    currentStep.type === 'website';

  // Count active rules
  const activeRuleCount = useMemo(() => {
    let count = 0;
    if (validation.required) count++;
    if (validation.minLength) count++;
    if (validation.maxLength) count++;
    if (validation.exactLength) count++;
    if (validation.pattern) count++;
    if (validation.disallowSpaces) count++;
    if (currentStep.type === 'number' && (currentStep.numberMin !== undefined || currentStep.numberMax !== undefined)) count++;
    return count;
  }, [validation, currentStep]);

  return (
    <div className="space-y-6 text-slate-900 pb-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span className="font-headline-sm text-xs font-bold uppercase tracking-wider font-mono-code text-slate-300">
              Input Validation Engine
            </span>
          </div>
          <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
            {activeRuleCount} active rule{activeRuleCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configure real-time formatting constraints, regex patterns, character limits, and tailored error messages for this field.
        </p>
      </div>

      {/* Quick 1-Click Validation Presets */}
      {isTextType && (
        <div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2 font-mono-code">
            Quick 1-Click Templates
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickTemplates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={t.apply}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: Mandatory / Required Requirement */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Required Response</span>
              {validation.required && (
                <span className="text-[10px] font-mono-code font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Enforced
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Respondents cannot proceed to the next question until an answer is provided.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 rounded-full">
            <input
              type="checkbox"
              id="field-validation-required"
              checked={validation.required ?? false}
              onChange={(e) => updateValidation({ required: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Custom Required Error Message */}
        {validation.required && (
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Custom Required Error Message
            </label>
            <input
              type="text"
              id="field-custom-required-message"
              value={validation.customRequiredMessage || ''}
              onChange={(e) => updateValidation({ customRequiredMessage: e.target.value })}
              placeholder={`e.g. Please enter your ${currentStep.title ? currentStep.title.toLowerCase() : 'answer'} to continue.`}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Leave blank to use the default: &ldquo;This question is required. Please provide a response.&rdquo;
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: Character Length Constraints (Min, Max, Exact, Live Counter) */}
      {isTextType && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Type className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-900">Length & Character Bounds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Minimum Length */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Minimum Length (characters)
              </label>
              <input
                type="number"
                min={0}
                id="field-validation-min-length"
                value={validation.minLength ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10));
                  updateValidation({ minLength: val });
                }}
                placeholder="0 (no minimum)"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-indigo-600 focus:outline-none transition shadow-2xs"
              />
            </div>

            {/* Maximum Length */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Maximum Length (characters)
              </label>
              <input
                type="number"
                min={0}
                id="field-validation-max-length"
                value={validation.maxLength ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10));
                  updateValidation({ maxLength: val });
                }}
                placeholder="Unlimited"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-indigo-600 focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Granular Min/Max Error Messages */}
          {(validation.minLength || validation.maxLength) && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {Boolean(validation.minLength) && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Custom Min-Length Error Message
                  </label>
                  <input
                    type="text"
                    value={validation.customMinLengthMessage || ''}
                    onChange={(e) => updateValidation({ customMinLengthMessage: e.target.value })}
                    placeholder={`e.g. Please enter at least ${validation.minLength} characters.`}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
                  />
                </div>
              )}

              {Boolean(validation.maxLength) && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Custom Max-Length Error Message
                  </label>
                  <input
                    type="text"
                    value={validation.customMaxLengthMessage || ''}
                    onChange={(e) => updateValidation({ customMaxLengthMessage: e.target.value })}
                    placeholder={`e.g. Your response cannot exceed ${validation.maxLength} characters.`}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Character Counter & Whitespace Toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={validation.showCharCount ?? true}
                onChange={(e) => updateValidation({ showCharCount: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600 border-slate-300 accent-indigo-600"
              />
              <span className="font-medium">Show live character counter in respondent view</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={validation.disallowSpaces ?? false}
                onChange={(e) => updateValidation({ disallowSpaces: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600 border-slate-300 accent-indigo-600"
              />
              <span className="font-medium">Disallow whitespace (spaces/tabs strictly forbidden)</span>
            </label>
          </div>
        </div>
      )}

      {/* SECTION 3: Regular Expression (Regex) Patterns & Presets */}
      {isTextType && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Format & Regex Pattern</span>
            </div>
            {validation.pattern && (
              <button
                type="button"
                onClick={() => handleSelectPreset('none')}
                className="text-[11px] text-slate-500 hover:text-red-600 font-medium flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Pattern</span>
              </button>
            )}
          </div>

          {/* Preset Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Select Regex Pattern Preset
            </label>
            <select
              id="field-regex-preset-select"
              value={currentPresetId}
              onChange={(e) => handleSelectPreset(e.target.value as RegexPresetId)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <optgroup label="General">
                <option value="none">None (Freeform Text)</option>
                <option value="custom">⚡ Custom Regular Expression...</option>
              </optgroup>
              <optgroup label="Contact & Web">
                <option value="email_standard">Standard Email Address</option>
                <option value="email_corporate">Corporate / Business Email (Blocks Gmail/Yahoo)</option>
                <option value="phone_us">US / Canada Phone Number</option>
                <option value="phone_intl">International Phone Number (E.164)</option>
                <option value="url_web">Website URL (http/https)</option>
              </optgroup>
              <optgroup label="Text & Numbers">
                <option value="letters_only">Letters & Spaces Only (Legal Names)</option>
                <option value="alphanumeric">Alphanumeric (Letters & Digits Only)</option>
                <option value="numbers_only">Integer Numbers Only</option>
                <option value="currency_usd">Currency Amount ($ USD)</option>
              </optgroup>
              <optgroup label="Identifiers & Handles">
                <option value="handle_twitter">X / Twitter Handle (@handle)</option>
                <option value="handle_github">GitHub Username</option>
                <option value="slug">URL-friendly Slug (kebab-case)</option>
                <option value="hex_color">Hex Color Code (#RRGGBB)</option>
                <option value="uuid">UUID / GUID Identifier</option>
              </optgroup>
              <optgroup label="Regional & Postal">
                <option value="zip_us">US Postal ZIP Code</option>
                <option value="postal_uk">UK Postal Code</option>
                <option value="postal_ca">Canadian Postal Code</option>
                <option value="ssn_us">US Social Security Number (SSN)</option>
              </optgroup>
            </select>
          </div>

          {/* Active Preset Description & Example */}
          {activePreset && activePreset.id !== 'none' && activePreset.id !== 'custom' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>{activePreset.description}</span>
              </div>
              <div className="font-mono-code text-[11px] text-slate-500 flex items-center gap-1">
                <span>Example:</span>
                <span className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {activePreset.example}
                </span>
              </div>
            </div>
          )}

          {/* Regex Pattern & Flags Inputs (Shown if pattern active or custom selected) */}
          {(currentPresetId !== 'none' || validation.pattern) && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Regular Expression Pattern
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-code text-slate-400">
                      /
                    </span>
                    <input
                      type="text"
                      id="field-regex-pattern-input"
                      value={validation.pattern || ''}
                      onChange={(e) =>
                        updateValidation({
                          pattern: e.target.value,
                          patternPreset: currentPresetId === 'none' ? 'custom' : currentPresetId,
                        })
                      }
                      placeholder="^[a-zA-Z0-9]+$"
                      className="w-full text-xs font-mono-code border border-slate-200 rounded-xl pl-6 pr-3 py-2.5 focus:border-indigo-600 focus:outline-none transition bg-white shadow-2xs"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="text"
                      id="field-regex-flags-input"
                      value={validation.patternFlags || ''}
                      onChange={(e) => updateValidation({ patternFlags: e.target.value })}
                      placeholder="flags (i,m)"
                      title="RegExp flags like 'i' for case-insensitive"
                      className="w-full text-xs font-mono-code border border-slate-200 rounded-xl px-2.5 py-2.5 focus:border-indigo-600 focus:outline-none transition bg-white shadow-2xs text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Pattern Error Message */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Custom Pattern Error Message
                </label>
                <input
                  type="text"
                  id="field-custom-pattern-message"
                  value={validation.customPatternMessage || ''}
                  onChange={(e) => updateValidation({ customPatternMessage: e.target.value })}
                  placeholder="e.g. Please enter a valid format."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
                />
              </div>

              {/* Interactive Live Regex Test Sandbox */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider font-mono-code">
                      Interactive Pattern Sandbox
                    </span>
                  </div>
                  {activePreset?.example && (
                    <button
                      type="button"
                      onClick={() => setTestValue(activePreset?.example ?? '')}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 transition cursor-pointer underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                    >
                      Fill Example
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    placeholder="Type sample text to test this regex live..."
                    className="w-full text-xs border border-slate-200 rounded-xl pl-3 pr-24 py-2 bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
                  />

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                    {regexTestResult.compileError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                        <AlertCircle className="w-3 h-3" />
                        Regex Error
                      </span>
                    ) : !testValue ? (
                      <span className="text-[10px] text-slate-400 font-mono-code">Waiting for test</span>
                    ) : regexTestResult.isValid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Valid Match
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        No Match
                      </span>
                    )}
                  </div>
                </div>

                {regexTestResult.compileError && (
                  <p className="text-[10px] text-red-600 font-mono-code">
                    {regexTestResult.compileError}
                  </p>
                )}

                {testValue && !regexTestResult.isValid && !regexTestResult.compileError && (
                  <p className="text-[11px] text-slate-500">
                    Will display error:{' '}
                    <span className="font-medium text-slate-800 italic">
                      &ldquo;{validation.customPatternMessage || activePreset?.defaultError || 'Please match the requested format.'}&rdquo;
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: Numeric Range Limits & Messages (if question type is 'number') */}
      {currentStep.type === 'number' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Hash className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900">Numerical Range & Step</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Minimum Value
              </label>
              <input
                type="number"
                value={currentStep.numberMin ?? ''}
                onChange={(e) =>
                  onUpdateStep({
                    numberMin: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="No minimum"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-indigo-600 focus:outline-none transition shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Maximum Value
              </label>
              <input
                type="number"
                value={currentStep.numberMax ?? ''}
                onChange={(e) =>
                  onUpdateStep({
                    numberMax: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="No maximum"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-indigo-600 focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Custom Range Error Message
            </label>
            <input
              type="text"
              value={validation.customRangeMessage || ''}
              onChange={(e) => updateValidation({ customRangeMessage: e.target.value })}
              placeholder={`e.g. Please enter a value between ${currentStep.numberMin ?? '0'} and ${currentStep.numberMax ?? '100'}.`}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* SECTION 5: General Fallback Custom Error Message */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
        <label className="block text-xs font-bold text-slate-900 mb-0.5">
          General Fallback Error Message
        </label>
        <p className="text-[11px] text-slate-500 mb-2">
          Displayed if any other unhandled validation constraint fails on this question.
        </p>
        <input
          type="text"
          id="field-general-fallback-error-message"
          value={validation.customErrorMessage || ''}
          onChange={(e) => updateValidation({ customErrorMessage: e.target.value })}
          placeholder="e.g. Please check your answer and try again."
          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
        />
      </div>
    </div>
  );
};
