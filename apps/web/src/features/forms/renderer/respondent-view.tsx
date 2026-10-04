import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { UploadFn } from '../registry';
import { useFormSession, type SubmitFn } from '../session/use-form-session';
import { ClassicRenderer } from './classic-renderer';
import { ConversationalRenderer } from './conversational-renderer';
import { RendererBoundary } from './renderer-boundary';
import type { RespondentForm } from './respondent-form';

export function RespondentView(props: { form: RespondentForm; submit: SubmitFn; storageKey: string | null; mode: 'fill' | 'preview'; upload?: UploadFn; banner?: ReactNode; hidden?: Record<string, string> }) {
  const session = useFormSession({ form: props.form, submit: props.submit, storageKey: props.storageKey, hidden: props.hidden });
  const Renderer = props.form.settings.layout === 'conversational' ? ConversationalRenderer : ClassicRenderer;
  return (
    <RendererBoundary>
      {session.hasSavedProgress && (
        <div role="region" aria-label="Saved progress" className="sticky top-0 z-10 flex flex-wrap items-center justify-center gap-3 bg-[#fef7e0] px-4 py-2 text-sm">
          You have unfinished answers saved on this device.
          <Button size="sm" onClick={session.resume}>
            Continue where I left off
          </Button>
          <Button size="sm" variant="ghost" onClick={session.discardSaved}>
            Start over
          </Button>
        </div>
      )}
      <Renderer form={props.form} session={session} mode={props.mode} upload={props.upload} banner={props.banner} />
    </RendererBoundary>
  );
}
