import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormConfig } from '../../types';
import { FormBuilder } from '../../components/FormBuilder';
import { incrementFormStartFn, updateFormFn } from '@/formsV3/api/workspaces';
import { getSharableFormUrl } from '../../utils/shareUtils';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

interface FormBuilderPageProps {
  form: FormConfig;
}

// How long to wait after the last edit before actually writing to the
// database — keeps rapid typing from firing a request per keystroke while
// still saving automatically, with no user action required.
const SAVE_DEBOUNCE_MS = 800;

export function FormBuilderPage({ form: initialForm }: FormBuilderPageProps) {
  const [form, setForm] = useState<FormConfig>(initialForm);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const updateForm = updateFormFn;
  const incrementFormStart = incrementFormStartFn;

  // The next unsaved snapshot to write, and the timer counting down to it.
  const pendingFormRef = useRef<FormConfig | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const flushSave = useCallback(async () => {
    if (inFlightRef.current) return
    const toSave = pendingFormRef.current
    if (!toSave) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    pendingFormRef.current = null
    inFlightRef.current = true
    setSaveStatus('saving')

    try {
      const { form: saved } = await updateForm({ data: { ...toSave } })
      inFlightRef.current = false
      if (pendingFormRef.current) {
        // More edits arrived while this request was in flight — save those next.
        setSaveStatus('pending')
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => { flushSave() }, SAVE_DEBOUNCE_MS)
      } else {
        setForm(saved)
        setSaveStatus('saved')
        setLastSavedAt(Date.now())
      }
    } catch {
      inFlightRef.current = false
      // Put the failed edit back so the next change (or a manual retry) tries
      // again — but only if no *newer* edit was already queued while this
      // request was in flight. Overwriting that newer edit with the stale
      // one that just failed would silently discard it.
      if (!pendingFormRef.current) pendingFormRef.current = toSave
      setSaveStatus('error')
    }
  }, [updateForm])

  const handleSaveForm = useCallback(
    (updated: FormConfig) => {
      setForm(updated)
      pendingFormRef.current = updated
      setSaveStatus('pending')
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => { flushSave() }, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const handleLaunchFullscreenDemo = async () => {
    if (form.status !== 'published') {
      const publishedForm = { ...form, status: 'published' as const };
      setForm(publishedForm);
      try {
        await updateForm({ data: publishedForm });
      } catch {
        // Continue to open
      }
    }
    window.open(getSharableFormUrl(form.id), '_blank', 'noopener,noreferrer');
    try {
      await incrementFormStart({ data: { id: form.id } });
    } catch {
      // Non-critical
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 selection:bg-indigo-600 selection:text-white font-sans antialiased">
      {/* Ambient background decoration */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />
      <main className="flex-1 flex flex-col">
        <FormBuilder
          form={form}
          onSaveForm={handleSaveForm}
          onForceSave={flushSave}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onLaunchFullscreenDemo={handleLaunchFullscreenDemo}
        />
      </main>
    </div>
  );
}
