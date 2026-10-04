import type { DriveItemDto } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { cn } from '@/lib/utils';
import { driveService } from '@/services/drive';

/** Enough of a text file to fill a card. */
const TEXT_BYTES = 2048;

function TextThumbnail({ id, version, onError }: { id: string; version: string; onError(): void }) {
  const text = useQuery({
    queryKey: ['drive', 'text-thumbnail', id, version],
    queryFn: async ({ signal }) => {
      const res = await fetch(driveService.thumbnailContentUrl(id), { headers: { Range: `bytes=0-${TEXT_BYTES - 1}` }, credentials: 'include', signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = new TextDecoder().decode(await res.arrayBuffer());
      // A range can end mid-line (or mid-character); drop the partial last line.
      return body.length >= TEXT_BYTES - 4 ? body.slice(0, body.lastIndexOf('\n') + 1 || undefined) : body;
    },
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (text.isError) onError();
  }, [text.isError, onError]);
  return (
    <pre className="size-full overflow-hidden whitespace-pre-wrap break-words bg-white p-3 font-mono text-[9px] leading-[1.35] text-foreground/80" aria-hidden>
      {text.data}
    </pre>
  );
}

/**
 * A file's thumbnail: the server-made one for images and PDFs, a video's first frame, a text file's first lines,
 * otherwise its type icon (also the fallback whenever a thumbnail can't load).
 */
export function FileThumbnail({ item, iconSize = 64, fit = 'cover' }: { item: DriveItemDto; iconSize?: number; fit?: 'cover' | 'contain' }) {
  const [failed, setFailed] = useState(false);
  const src = item.kind === 'file' ? item.thumbnailUrl : null;
  useEffect(() => setFailed(false), [src, item.id]);
  const fail = () => setFailed(true);

  if (item.kind === 'file' && !item.isTrashed && !failed) {
    if (item.thumbnailUrl) {
      return (
        <img
          src={driveService.thumbnailUrl(item.thumbnailUrl)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={fail}
          className={cn('size-full', fit === 'cover' ? 'bg-white object-cover object-top' : 'object-contain')}
        />
      );
    }
    if (item.fileType === 'VIDEO') {
      // The fragment asks for the frame one second in, past fade-ins from black.
      return <video src={`${driveService.thumbnailContentUrl(item.id)}#t=1`} preload="metadata" muted playsInline disablePictureInPicture onError={fail} className={cn('pointer-events-none size-full bg-black', fit === 'cover' ? 'object-cover' : 'object-contain')} aria-hidden />;
    }
    if (item.fileType === 'TEXT' && item.size > 0) return <TextThumbnail id={item.id} version={item.updatedAt} onError={fail} />;
  }
  return (
    <div className="flex size-full items-center justify-center">
      <FileIcon type={item.kind === 'folder' ? 'FOLDER' : item.fileType} size={iconSize} />
    </div>
  );
}
