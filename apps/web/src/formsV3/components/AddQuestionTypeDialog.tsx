import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from '../lib/motion';
import {
  X,
  Search,
  Sparkles,
  Type,
  AlignLeft,
  Mail,
  Phone,
  Globe,
  ListOrdered,
  ChevronDown,
  ToggleLeft,
  SlidersHorizontal,
  Star,
  Hash,
  Calendar,
  Upload,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import type { QuestionType } from '../types';
import { useModalA11y } from '../hooks/useModalA11y';

interface QuestionTypeOption {
  type: QuestionType;
  title: string;
  category: 'Text & Contact' | 'Choices & Selection' | 'Rating & Numbers' | 'Media & Dates' | 'Special Screens';
  description: string;
  badge?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const QUESTION_TYPES: QuestionTypeOption[] = [
  // Text & Contact
  {
    type: 'short_text',
    title: 'Short Text',
    category: 'Text & Contact',
    description: 'Single-line input for names, brief answers, or titles.',
    icon: <Type className="w-4 h-4" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    type: 'long_text',
    title: 'Long Text',
    category: 'Text & Contact',
    description: 'Multi-line text area for feedback, stories, or paragraphs.',
    icon: <AlignLeft className="w-4 h-4" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    type: 'email',
    title: 'Email Address',
    category: 'Text & Contact',
    description: 'Verified email format with instant syntax validation.',
    icon: <Mail className="w-4 h-4" />,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    type: 'phone',
    title: 'Phone Number',
    category: 'Text & Contact',
    description: 'International phone input with digits and formatting.',
    icon: <Phone className="w-4 h-4" />,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    type: 'website',
    title: 'Website URL',
    category: 'Text & Contact',
    description: 'Web link or portfolio domain with protocol check.',
    icon: <Globe className="w-4 h-4" />,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },

  // Choices & Selection
  {
    type: 'multiple_choice',
    title: 'Multiple Choice',
    category: 'Choices & Selection',
    description: 'Visual option cards with keyboard shortcuts (A, B, C).',
    badge: 'Popular',
    icon: <ListOrdered className="w-4 h-4" />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    type: 'dropdown',
    title: 'Dropdown Menu',
    category: 'Choices & Selection',
    description: 'Compact collapsible selector for long lists of options.',
    icon: <ChevronDown className="w-4 h-4" />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    type: 'yes_no',
    title: 'Yes / No',
    category: 'Choices & Selection',
    description: 'Binary decision cards with instant single-key shortcuts.',
    icon: <ToggleLeft className="w-4 h-4" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },

  // Rating & Numbers
  {
    type: 'opinion_scale',
    title: 'Opinion Scale / NPS',
    category: 'Rating & Numbers',
    description: 'Horizontal 0–10 or 0–5 scale for satisfaction and NPS.',
    badge: 'NPS',
    icon: <SlidersHorizontal className="w-4 h-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    type: 'rating',
    title: 'Star Rating',
    category: 'Rating & Numbers',
    description: 'Visual star ratings from 1 to 5 (or up to 10 stars).',
    icon: <Star className="w-4 h-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    type: 'number',
    title: 'Number / Currency',
    category: 'Rating & Numbers',
    description: 'Numeric amounts with prefixes ($, €), limits, and units.',
    icon: <Hash className="w-4 h-4" />,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },

  // Media & Dates
  {
    type: 'date',
    title: 'Date Picker',
    category: 'Media & Dates',
    description: 'Calendar date selection with min/max range boundaries.',
    icon: <Calendar className="w-4 h-4" />,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
  {
    type: 'file_upload',
    title: 'File Upload',
    category: 'Media & Dates',
    description: 'Drag-and-drop file attachment with size & extension rules.',
    badge: 'New',
    icon: <Upload className="w-4 h-4" />,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },

  // Special Screens
  {
    type: 'welcome',
    title: 'Welcome Screen',
    category: 'Special Screens',
    description: 'Introductory landing screen with estimated time and title.',
    icon: <Sparkles className="w-4 h-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    type: 'statement',
    title: 'Statement Screen',
    category: 'Special Screens',
    description: 'Information or terms banner without requiring user input.',
    icon: <FileText className="w-4 h-4" />,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
  },
  {
    type: 'thank_you',
    title: 'Thank You Screen',
    category: 'Special Screens',
    description: 'Completion message with custom redirects and restart action.',
    icon: <CheckCircle2 className="w-4 h-4" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

interface AddQuestionTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: QuestionType) => void;
}

export const AddQuestionTypeDialog: React.FC<AddQuestionTypeDialogProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory('All');
    }
  }, [isOpen]);

  // Handles Escape-to-close, focus trap (Tab cycling within the dialog),
  // initial focus (the search input, via initialFocusRef below), and
  // returning focus to whatever opened the dialog on close.
  useModalA11y(isOpen, onClose, dialogRef, inputRef);

  // Categories list
  const categories = ['All', 'Text & Contact', 'Choices & Selection', 'Rating & Numbers', 'Media & Dates', 'Special Screens'];

  const filteredQuestions = useMemo(() => {
    return QUESTION_TYPES.filter((q) => {
      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
      const qLower = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !qLower ||
        q.title.toLowerCase().includes(qLower) ||
        q.description.toLowerCase().includes(qLower) ||
        q.category.toLowerCase().includes(qLower) ||
        q.type.toLowerCase().includes(qLower);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Dialog Card */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 ring-1 ring-slate-950/5 flex flex-col overflow-hidden z-10 focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-question-dialog-title"
            tabIndex={-1}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h3
                  id="add-question-dialog-title"
                  className="font-headline-sm text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight"
                >
                  Add Question or Step
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select a question type or interactive screen to insert into your form
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search question types (e.g. email, rating, upload)…"
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 transition placeholder:text-slate-400 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Categories Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      selectedCategory === cat
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                        : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/40">
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 border border-slate-200/60">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">No question types found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try searching for another keyword or reset the category filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-3 text-xs font-semibold text-indigo-700 underline hover:text-indigo-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredQuestions.map((q) => (
                    <button
                      key={q.type}
                      type="button"
                      id={`btn-dialog-add-${q.type}`}
                      onClick={() => {
                        onSelectType(q.type);
                        onClose();
                      }}
                      className="group p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition-all text-left flex items-start gap-3 shadow-2xs hover:shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl ${q.iconBg} ${q.iconColor} flex items-center justify-center shrink-0 border border-black/5 group-hover:scale-105 transition-transform`}
                      >
                        {q.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                            {q.title}
                          </span>
                          {q.badge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 font-mono-code">
                              {q.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 leading-snug line-clamp-2">
                          {q.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono-code text-[11px]">
                {filteredQuestions.length} type{filteredQuestions.length === 1 ? '' : 's'} available
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
