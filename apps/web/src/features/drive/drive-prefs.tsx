import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/misc';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { cn } from '@/lib/utils';
import type { ViewMode } from './items-view';
import { BlockedPeopleDialog } from './spam-dialogs';

export const START_PAGES = { 'my-drive': '/drive', recent: '/drive/recent', starred: '/drive/starred', shared: '/drive/shared' } as const;
export type StartPage = keyof typeof START_PAGES;
export type Density = 'comfortable' | 'compact';

const KEYS = { density: 'qub.drive.density', start: 'qub.drive.start', suggested: 'qub.drive.suggested', view: 'qub.drive.view' } as const;

/** Where "/" should land, read before React renders (the index route's redirect). */
export function startPagePath(): string {
  try {
    const v = localStorage.getItem(KEYS.start) as StartPage | null;
    return v && v in START_PAGES ? START_PAGES[v] : '/drive';
  } catch {
    return '/drive';
  }
}

interface DrivePrefs {
  density: Density;
  setDensity(d: Density): void;
  startPage: StartPage;
  setStartPage(p: StartPage): void;
  showSuggested: boolean;
  setShowSuggested(v: boolean): void;
  viewMode: ViewMode;
  setViewMode(m: ViewMode): void;
}

const Ctx = createContext<DrivePrefs | null>(null);

/** Per-browser display preferences for Drive. */
export function DrivePrefsProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useLocalPreference<Density>(KEYS.density, 'comfortable', ['comfortable', 'compact']);
  const [startPage, setStartPage] = useLocalPreference<StartPage>(KEYS.start, 'my-drive', Object.keys(START_PAGES) as StartPage[]);
  const [suggested, setSuggested] = useLocalPreference<'show' | 'hide'>(KEYS.suggested, 'show', ['show', 'hide']);
  const [viewMode, setViewMode] = useLocalPreference<ViewMode>(KEYS.view, 'list', ['list', 'grid']);
  const value = useMemo<DrivePrefs>(
    () => ({ density, setDensity, startPage, setStartPage, showSuggested: suggested === 'show', setShowSuggested: (v) => setSuggested(v ? 'show' : 'hide'), viewMode, setViewMode }),
    [density, setDensity, startPage, setStartPage, suggested, setSuggested, viewMode, setViewMode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDrivePrefs(): DrivePrefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDrivePrefs outside DrivePrefsProvider');
  return ctx;
}

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange(v: T): void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm', value === o.value ? 'border-primary bg-[#e8f0fe]' : 'border-border hover:bg-surface')}>
          <input type="radio" name={name} className="mt-0.5" checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <span className="block font-medium">{o.label}</span>
            {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function DriveSettingsDialog({ open, onOpenChange, onShowShortcuts }: { open: boolean; onOpenChange(o: boolean): void; onShowShortcuts(): void }) {
  const p = useDrivePrefs();
  const [blockedOpen, setBlockedOpen] = useState(false);
  return (
    <>
    <BlockedPeopleDialog open={blockedOpen} onOpenChange={setBlockedOpen} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Drive settings" description="Display settings are saved in this browser.">
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-medium">Density</h3>
            <Choice
              name="Density"
              value={p.density}
              onChange={p.setDensity}
              options={[
                { value: 'comfortable', label: 'Comfortable', hint: 'More space between rows and cards' },
                { value: 'compact', label: 'Compact', hint: 'See more files at once' },
              ]}
            />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">Start page</h3>
            <p className="mb-2 text-xs text-muted">Where Qub opens when you go to its home address.</p>
            <Choice
              name="Start page"
              value={p.startPage}
              onChange={p.setStartPage}
              options={[
                { value: 'my-drive', label: 'My Drive' },
                { value: 'recent', label: 'Recent' },
                { value: 'starred', label: 'Starred' },
                { value: 'shared', label: 'Shared with me' },
              ]}
            />
          </section>
          <section>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3">
              <span>
                <span className="block text-sm font-medium">Show suggested files</span>
                <span className="block text-xs text-muted">Files you’re likely to need, at the top of My Drive</span>
              </span>
              <input type="checkbox" className="size-4" checked={p.showSuggested} onChange={(e) => p.setShowSuggested(e.target.checked)} />
            </label>
          </section>
          <section className="flex items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Blocked people</span>
              <span className="block text-xs text-muted">They can’t share files with you or notify you. Applies to your account everywhere.</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => setBlockedOpen(true)}>
              Manage
            </Button>
          </section>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => (onOpenChange(false), onShowShortcuts())}>
            Keyboard shortcuts
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

const SHORTCUTS: { group: string; items: [string[], string][] }[] = [
  {
    group: 'Navigation',
    items: [
      [['/'], 'Search in Drive'],
      [['↑', '↓', '←', '→'], 'Move between files'],
      [['Shift', '↑ ↓'], 'Extend the selection'],
      [['Ctrl', 'A'], 'Select all'],
      [['Esc'], 'Clear the selection or close the viewer'],
    ],
  },
  {
    group: 'Files',
    items: [
      [['Enter'], 'Open'],
      [['P'], 'Preview'],
      [['N'], 'Rename'],
      [['.'], 'Share'],
      [['Z'], 'Move'],
      [['S'], 'Add to or remove from starred'],
      [['Del'], 'Move to trash'],
    ],
  },
  {
    group: 'Create',
    items: [
      [['Shift', 'U'], 'Upload files'],
      [['Shift', 'I'], 'Upload a folder'],
      [['Shift', 'F'], 'New folder'],
    ],
  },
  {
    group: 'View',
    items: [
      [['V'], 'Switch between list and grid'],
      [['I'], 'Show or hide details'],
      [['Shift', 'A'], 'Show or hide activity'],
      [['?'], 'Keyboard shortcuts'],
    ],
  },
  {
    group: 'Viewer',
    items: [
      [['←', '→'], 'Previous or next file'],
      [['+', '−'], 'Zoom in or out'],
      [['0'], 'Fit to screen'],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard shortcuts" className="max-w-2xl">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.group}</h3>
              <dl className="space-y-1.5 text-sm">
                {g.items.map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt>{label}</dt>
                    <dd className="flex shrink-0 gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** True when a key press is meant for a text field, menu or dialog rather than a Drive shortcut. */
export function isTypingTarget(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="listbox"]') || e.ctrlKey || e.metaKey || e.altKey;
}
