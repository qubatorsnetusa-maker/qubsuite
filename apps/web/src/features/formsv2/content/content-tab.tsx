import { LayoutList, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFormV2 } from '../layout/use-form-v2';
import { QuestionCanvas } from './question-canvas';
import { QuestionList } from './question-list';
import { SettingsSidebar } from './settings-sidebar';

/**
 * Content tab: the three-panel builder. Left is the question list (`QuestionList`), centre is the selected
 * question edited in place at full size (`QuestionCanvas`), right is settings for the selection, or form settings
 * when nothing is selected (`SettingsSidebar`). Below `lg` the list and settings collapse into drawers opened from
 * a slim bar above the canvas.
 */
export function ContentTab() {
  const { form, canEdit } = useFormV2();
  const [selectedId, setSelectedId] = useState<string | null>(form.fields[0]?.id ?? null);
  const [listOpen, setListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The selected field can disappear from under us (delete, undo, a collaborator's edit); fall back to form
  // settings (null) rather than keep pointing at a field that's gone.
  useEffect(() => {
    if (selectedId && !form.fields.some((f) => f.id === selectedId)) setSelectedId(null);
  }, [form.fields, selectedId]);

  const selected = form.fields.find((f) => f.id === selectedId) ?? null;

  const select = (id: string | null) => {
    setSelectedId(id);
    setListOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2 lg:hidden">
        <Button type="button" variant="outline" size="sm" onClick={() => setListOpen(true)}>
          <LayoutList /> Questions
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 /> Settings
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Questions panel"
          className={cn('w-64 shrink-0 overflow-y-auto border-r border-border bg-background', listOpen ? 'fixed inset-y-0 left-0 z-40 shadow-pop' : 'hidden lg:flex lg:flex-col')}
        >
          {listOpen && (
            <div className="flex items-center justify-end border-b border-border p-1 lg:hidden">
              <Button type="button" variant="subtle" size="icon-sm" aria-label="Close questions panel" onClick={() => setListOpen(false)}>
                <X />
              </Button>
            </div>
          )}
          <QuestionList form={form} canEdit={canEdit} selectedId={selectedId} onSelect={select} />
        </aside>
        {listOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-hidden onClick={() => setListOpen(false)} />}

        <main className="min-w-0 flex-1 overflow-y-auto bg-surface-2" aria-label="Question canvas">
          <QuestionCanvas form={form} field={selected} canEdit={canEdit} onSelect={select} />
        </main>

        <aside
          aria-label="Settings panel"
          className={cn('w-80 shrink-0 overflow-y-auto border-l border-border bg-background', settingsOpen ? 'fixed inset-y-0 right-0 z-40 shadow-pop' : 'hidden lg:flex lg:flex-col')}
        >
          {settingsOpen && (
            <div className="flex items-center justify-end border-b border-border p-1 lg:hidden">
              <Button type="button" variant="subtle" size="icon-sm" aria-label="Close settings panel" onClick={() => setSettingsOpen(false)}>
                <X />
              </Button>
            </div>
          )}
          <SettingsSidebar form={form} field={selected} canEdit={canEdit} onShowFormSettings={() => select(null)} />
        </aside>
        {settingsOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-hidden onClick={() => setSettingsOpen(false)} />}
      </div>
    </div>
  );
}
