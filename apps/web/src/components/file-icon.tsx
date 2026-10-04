import type { FileType } from '@qub/shared';
import { Archive, FileAudio, FileImage, FileQuestion, FileText, FileVideo, Folder, FolderSymlink } from 'lucide-react';
import { cn } from '@/lib/utils';

/** App glyphs for Qub native files: a colored tile with a simple mark. */
function AppTile({ color, children, size }: { color: string; children: React.ReactNode; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="1.5" width="18" height="21" rx="2.5" fill={color} />
      {children}
    </svg>
  );
}

export function FileIcon({ type, size = 20, shared, className }: { type: FileType | 'FOLDER'; size?: number; shared?: boolean; className?: string }) {
  const s = { width: size, height: size };
  switch (type) {
    case 'FOLDER':
      return shared ? <FolderSymlink style={s} className={cn('text-muted', className)} fill="#80868b" stroke="#fff" /> : <Folder style={s} className={cn('text-[#5f6368]', className)} fill="#5f6368" stroke="#5f6368" />;
    case 'DOCUMENT':
      return (
        <span className={className}>
          <AppTile color="#4285f4" size={size}>
            <path d="M7 8h10M7 11.5h10M7 15h7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </AppTile>
        </span>
      );
    case 'SPREADSHEET':
      return (
        <span className={className}>
          <AppTile color="#0f9d58" size={size}>
            <path d="M7 7.5h10v9H7zM7 12h10M12 7.5v9" stroke="#fff" strokeWidth="1.5" fill="none" />
          </AppTile>
        </span>
      );
    case 'FORM':
      return (
        <span className={className}>
          <AppTile color="#7248b9" size={size}>
            <circle cx="8.5" cy="9" r="1.1" fill="#fff" />
            <circle cx="8.5" cy="12.5" r="1.1" fill="#fff" />
            <circle cx="8.5" cy="16" r="1.1" fill="#fff" />
            <path d="M11 9h5.5M11 12.5h5.5M11 16h5.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </AppTile>
        </span>
      );
    case 'PDF':
      return (
        <span className={className}>
          <AppTile color="#ea4335" size={size}>
            <text x="12" y="15.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#fff" fontFamily="Arial">PDF</text>
          </AppTile>
        </span>
      );
    case 'IMAGE':
      return <FileImage style={s} className={cn('text-[#d93025]', className)} />;
    case 'VIDEO':
      return <FileVideo style={s} className={cn('text-[#d93025]', className)} />;
    case 'AUDIO':
      return <FileAudio style={s} className={cn('text-[#e37400]', className)} />;
    case 'TEXT':
      return <FileText style={s} className={cn('text-[#4285f4]', className)} />;
    case 'ARCHIVE':
      return <Archive style={s} className={cn('text-[#5f6368]', className)} />;
    default:
      return <FileQuestion style={s} className={cn('text-[#5f6368]', className)} />;
  }
}

export const FILE_TYPE_LABEL: Record<FileType | 'FOLDER', string> = {
  FOLDER: 'Folder',
  DOCUMENT: 'Document',
  SPREADSHEET: 'Spreadsheet',
  FORM: 'Form',
  PDF: 'PDF',
  IMAGE: 'Image',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  TEXT: 'Text',
  ARCHIVE: 'Archive',
  OTHER: 'File',
};
