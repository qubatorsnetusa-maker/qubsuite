import { cn } from '@/lib/utils';

export function QubMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#1a56db" />
      <path d="M32 14a18 18 0 1 0 10.4 32.7l5.1 5.1 4.2-4.2-5.1-5.1A18 18 0 0 0 32 14Zm0 6a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z" fill="#fff" />
    </svg>
  );
}

export function QubLogo({ product, className }: { product?: 'Drive' | 'Docs' | 'Sheets' | 'Forms' | 'QubDocs' | string; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <QubMark size={34} />
      <span className="text-[22px] leading-none text-muted">
        {product === 'QubDocs' ? (
          <span className="font-semibold text-foreground">QubDocs</span>
        ) : (
          <>
            <span className="font-semibold text-foreground">Qub</span>
            {product && <span className="ml-1">{product}</span>}
          </>
        )}
      </span>
    </span>
  );
}
