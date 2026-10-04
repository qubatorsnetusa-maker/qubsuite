import type { FormFieldDto } from '@qub/shared';

/** YouTube / Vimeo watch URLs → privacy-friendly embed URLs; null for direct video files. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' && u.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.searchParams.get('v')!)}`;
    if (host === 'youtu.be' && u.pathname.length > 1) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (host === 'vimeo.com' && /^\/\d+$/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
    return null;
  } catch {
    return null;
  }
}

/** Statement, image and video blocks. `pipe` interpolates {{keys}}; output is rendered as text. */
export function ContentBlock({ field, pipe }: { field: FormFieldDto; pipe(text: string): string }) {
  const s = field.settings;
  if (field.type === 'IMAGE_BLOCK') {
    return s.imageUrl ? <img src={s.imageUrl} alt={s.imageAlt ?? ''} className="max-h-[60vh] w-full rounded-lg object-contain" /> : null;
  }
  if (field.type === 'VIDEO_BLOCK') {
    if (!s.videoUrl) return null;
    const embed = videoEmbedUrl(s.videoUrl);
    return embed ? (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe src={embed} title={field.label || 'Video'} className="size-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation" />
      </div>
    ) : (
      <video src={s.videoUrl} controls className="w-full rounded-lg" aria-label={field.label || 'Video'} />
    );
  }
  // STATEMENT (and screens rendered as blocks)
  return (
    <div className="space-y-3">
      {s.imageUrl && <img src={s.imageUrl} alt={s.imageAlt ?? ''} className="max-h-64 rounded-lg object-contain" />}
      {field.description && <p className="whitespace-pre-wrap text-base text-muted">{pipe(field.description)}</p>}
    </div>
  );
}
