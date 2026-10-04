import { useState } from 'react';
import { LayoutGrid, List, Bell, Check } from 'lucide-react';
import { updateUserPreferencesFn, type UserPreferences } from '@/formsV3/api/preferences';
import type { WorkspaceSortOption } from '../workspace/WorkspaceFilterBar';

interface PreferencesCardProps {
  preferences: UserPreferences;
}

const SORT_OPTIONS: { value: WorkspaceSortOption; label: string }[] = [
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'title_asc', label: 'Name (A-Z)' },
  { value: 'responses_desc', label: 'Most Responses' },
  { value: 'completion_desc', label: 'Highest Conversion %' },
  { value: 'steps_desc', label: 'Most Steps' },
];

export function PreferencesCard({ preferences: initialPreferences }: PreferencesCardProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences);
  const [savedField, setSavedField] = useState<keyof UserPreferences | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const updatePreferences = updateUserPreferencesFn;

  async function persist<K extends keyof UserPreferences>(field: K, value: UserPreferences[K]) {
    const previous = preferences[field];
    setPreferences((prev: UserPreferences) => ({ ...prev, [field]: value }));
    setErrorMessage(null);
    try {
      await updatePreferences({ data: { [field]: value } });
      setSavedField(field);
      window.setTimeout(() => setSavedField((current) => (current === field ? null : current)), 1500);
    } catch {
      setPreferences((prev: UserPreferences) => ({ ...prev, [field]: previous }));
      setErrorMessage('Could not save that change. Please try again.');
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
      <h2 className="font-headline-sm text-sm font-bold text-slate-900 mb-1">Preferences</h2>
      <p className="text-xs text-slate-500 mb-5">
        Defaults applied when you open your workspace or create a new form.
      </p>

      <div className="space-y-5">
        {/* Default view mode */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700">Default workspace view</label>
            {savedField === 'defaultViewMode' && <SavedBadge />}
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              onClick={() => persist('defaultViewMode', 'grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                preferences.defaultViewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => persist('defaultViewMode', 'table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                preferences.defaultViewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Default sort order */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pref-sort-order" className="text-xs font-semibold text-slate-700">
              Default sort order
            </label>
            {savedField === 'defaultSortOption' && <SavedBadge />}
          </div>
          <select
            id="pref-sort-order"
            value={preferences.defaultSortOption}
            onChange={(e) => persist('defaultSortOption', e.target.value as WorkspaceSortOption)}
            className="w-full sm:w-64 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notify on submission */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Email me on new submissions</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Default for new forms — each form can still override this individually.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savedField === 'notifyOnSubmission' && <SavedBadge />}
            <button
              type="button"
              role="switch"
              aria-checked={preferences.notifyOnSubmission}
              aria-label="Email me on new submissions"
              onClick={() => persist('notifyOnSubmission', !preferences.notifyOnSubmission)}
              className={`relative w-9 h-5 rounded-full transition cursor-pointer ${
                preferences.notifyOnSubmission ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  preferences.notifyOnSubmission ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {errorMessage && <p className="mt-4 text-xs text-rose-600 font-medium">{errorMessage}</p>}
    </section>
  );
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 animate-in fade-in duration-150">
      <Check className="w-3 h-3" />
      Saved
    </span>
  );
}
