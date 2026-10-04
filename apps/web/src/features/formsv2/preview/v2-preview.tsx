/**
 * Desktop/Phone preview toggle for Forms v2.
 * Phone mode renders an iframe so Tailwind breakpoints (viewport-based) respond correctly.
 */
import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface V2PreviewProps {
  /** The URL to point the preview iframe at (the form's live/preview URL). */
  formUrl: string;
  /** True when we are the iframe content — hide the toggle so the form renders cleanly. */
  frame?: boolean;
  /** Render an iframe in Desktop mode too. The preview route draws the form itself and leaves this off. */
  desktopFrame?: boolean;
  /** Changing this remounts the iframe, so the preview picks up saved edits. */
  reloadKey?: string | number;
}

export function V2Preview({ formUrl, frame, desktopFrame, reloadKey }: V2PreviewProps) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');

  if (frame) {
    // Bare form — no chrome. The parent route renders the form renderer directly.
    return null;
  }

  const phoneUrl = formUrl.includes('?')
    ? `${formUrl}&device=phone`
    : `${formUrl}?device=phone`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Preview device">
        <Button
          variant={device === 'desktop' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setDevice('desktop')}
          role="radio"
          aria-checked={device === 'desktop'}
        >
          <Monitor className="size-4 mr-1.5" aria-hidden /> Desktop
        </Button>
        <Button
          variant={device === 'phone' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setDevice('phone')}
          role="radio"
          aria-checked={device === 'phone'}
        >
          <Smartphone className="size-4 mr-1.5" aria-hidden /> Phone
        </Button>
      </div>
      {device === 'phone' ? (
        <div className="flex justify-center">
          <iframe
            key={reloadKey}
            src={phoneUrl}
            width="390"
            height="844"
            title="Phone preview"
            className="rounded-3xl border shadow-xl"
            style={{ maxHeight: 'calc(100dvh - 160px)' }}
          />
        </div>
      ) : (
        desktopFrame && (
          <iframe key={reloadKey} src={formUrl} title="Desktop preview" className="w-full rounded-lg border shadow-sm" style={{ height: 'calc(100dvh - 220px)' }} />
        )
      )}
    </div>
  );
}
