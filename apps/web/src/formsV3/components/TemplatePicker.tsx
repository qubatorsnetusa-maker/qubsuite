import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  Layers,
  Play,
  CheckCircle2,
  Clock,
  Link2,
  Check,
  GitBranch,
  Sparkles,
  Search,
} from 'lucide-react';
import type { FormConfig } from '../types';
import { getSharableFormUrl, copyToClipboard } from '../utils/shareUtils';

interface TemplatePickerProps {
  templates: FormConfig[];
  currentFormId: string;
  onSelectAndPreview: (form: FormConfig) => void;
  onSelectAndEdit: (form: FormConfig) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  templates,
  currentFormId,
  onSelectAndPreview,
  onSelectAndEdit,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleCopy = async (formId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getSharableFormUrl(formId);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(formId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    templates.forEach((t) => {
      const f = t.folder || 'Other';
      counts[f] = (counts[f] || 0) + 1;
    });
    // Add logic branch count
    const logicCount = templates.filter((t) =>
      t.steps.some((s) => s.logic?.enabled && (s.logic.rules?.length || 0) > 0)
    ).length;
    counts['Branching Logic'] = logicCount;

    return counts;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Category filter
      if (selectedCategory === 'Branching Logic') {
        const hasLogic = tpl.steps.some(
          (s) => s.logic?.enabled && (s.logic.rules?.length || 0) > 0
        );
        if (!hasLogic) return false;
      } else if (selectedCategory !== 'all') {
        if (tpl.folder !== selectedCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = tpl.title.toLowerCase().includes(query);
        const matchesDesc = (tpl.description || '').toLowerCase().includes(query);
        const matchesSteps = tpl.steps.some((s) => s.title.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesSteps) return false;
      }

      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  return (
    <section className="py-16 bg-zinc-50 border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400 font-mono-code block mb-2">
              Ready-to-use Flows · 10 Curated Templates
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              Interactive Template Library
            </h2>
            <p className="text-zinc-600 text-sm mt-1 max-w-xl">
              Jumpstart your form with production-tested multi-step flows and conditional branching
              trees. Fully customizable in the builder.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates & questions..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 shadow-2xs"
            />
          </div>
        </div>

        {/* Filter Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            All Templates ({templates.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('Branching Logic')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'Branching Logic'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <GitBranch className="w-3 h-3" />
            <span>Branching Logic ({categories['Branching Logic'] || 0})</span>
          </button>

          {['Customer Feedback', 'Product Waitlists', 'Lead Generation', 'Events & RSVPs', 'Hiring & HR'].map(
            (folder) => {
              const count = categories[folder] || 0;
              if (count === 0) return null;
              const isSelected = selectedCategory === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setSelectedCategory(folder)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {folder} ({count})
                </button>
              );
            }
          )}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tpl) => {
            const isCurrent = tpl.id === currentFormId;
            const questionTypes = Array.from<string>(new Set(tpl.steps.map((s) => s.type)));
            const hasBranching = tpl.steps.some(
              (s) => s.logic?.enabled && (s.logic.rules?.length || 0) > 0
            );

            return (
              <div
                key={tpl.id}
                className={`p-6 rounded-2xl border bg-white flex flex-col justify-between transition-all hover:shadow-md ${
                  isCurrent ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono-code bg-zinc-100 text-zinc-700 font-medium">
                        {tpl.steps.length} Steps
                      </span>
                      {hasBranching && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <GitBranch className="w-3 h-3 text-emerald-600" />
                          Branching
                        </span>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 mb-1.5 leading-snug">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed mb-4 line-clamp-2">
                    {tpl.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {questionTypes.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-zinc-100 text-zinc-600 border border-zinc-200/60 capitalize"
                      >
                        {t.replace('_', ' ')}
                      </span>
                    ))}
                    {questionTypes.length > 5 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-code bg-zinc-50 text-zinc-400">
                        +{questionTypes.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectAndPreview(tpl)}
                    className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Form</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCopy(tpl.id, e)}
                    title="Copy unique share link for this form"
                    className={`py-2 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                      copiedId === tpl.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {copiedId === tpl.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="hidden sm:inline">Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectAndEdit(tpl)}
                    className="py-2 px-3 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-medium inline-flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

