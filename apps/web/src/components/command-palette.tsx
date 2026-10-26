import type { SearchResultDto } from '@qub/shared';
import { useNavigate } from '@tanstack/react-router';
import {
  FileText,
  FileSpreadsheet,
  CheckSquare,
  Folder,
  File,
  Search,
  PlusCircle,
  HardDrive,
  CornerDownLeft,
  X,
  Loader2,
  Presentation,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { driveService } from '@/services/drive';
import { formatRelative } from '@/lib/utils';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await driveService.search({ q: query.trim(), limit: 8 }, controller.signal);
        setResults(res.items);
        setSelectedIndex(0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const openResult = (r: SearchResultDto) => {
    setOpen(false);
    if (r.kind === 'folder') {
      void navigate({ to: '/drive/folder/$folderId', params: { folderId: r.id } });
      return;
    }
    switch (r.fileType) {
      case 'DOCUMENT':
        if (r.resourceId) void navigate({ to: '/docs/$documentId', params: { documentId: r.resourceId } });
        break;
      case 'SPREADSHEET':
        if (r.resourceId) void navigate({ to: '/sheets/$spreadsheetId', params: { spreadsheetId: r.resourceId } });
        break;
      case 'FORM':
        if (r.resourceId) void navigate({ to: '/forms/$formId', params: { formId: r.resourceId } });
        break;
      default:
        void navigate({ to: '/drive/file/$fileId', params: { fileId: r.id } });
    }
  };

  const quickActions = [
    { label: 'New Document', path: '/docs', icon: <FileText className="size-4 text-blue-600" /> },
    { label: 'New Spreadsheet', path: '/sheets', icon: <FileSpreadsheet className="size-4 text-emerald-600" /> },
    { label: 'New Presentation', path: '/slides', icon: <Presentation className="size-4 text-amber-500" /> },
    { label: 'New Form', path: '/forms', icon: <CheckSquare className="size-4 text-purple-600" /> },
    { label: 'Open Drive', path: '/drive', icon: <HardDrive className="size-4 text-slate-600" /> },
  ];

  const totalItems = query.trim() ? results.length : quickActions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && results[selectedIndex]) {
        openResult(results[selectedIndex]!);
      } else if (!query.trim() && quickActions[selectedIndex]) {
        setOpen(false);
        void navigate({ to: quickActions[selectedIndex]!.path as any });
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-pop-in text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documents, sheets, forms, or actions... (Ctrl+K)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted shrink-0" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Results or Quick Actions */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() ? (
            results.length > 0 ? (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Search Results ({results.length})
                </div>
                {results.map((r, idx) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onClick={() => openResult(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                      idx === selectedIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-hover'
                    }`}
                  >
                    {r.kind === 'folder' ? (
                      <Folder className="size-4 text-amber-500 shrink-0" />
                    ) : r.fileType === 'DOCUMENT' ? (
                      <FileText className="size-4 text-blue-500 shrink-0" />
                    ) : r.fileType === 'SPREADSHEET' ? (
                      <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
                    ) : r.fileType === 'FORM' ? (
                      <CheckSquare className="size-4 text-purple-500 shrink-0" />
                    ) : (
                      <File className="size-4 text-slate-500 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="text-[11px] text-muted shrink-0">
                      {formatRelative(r.updatedAt)}
                    </span>
                    {idx === selectedIndex && (
                      <CornerDownLeft className="size-3 text-muted shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : !loading ? (
              <div className="py-8 text-center text-xs text-muted">
                No matching files found for “{query}”
              </div>
            ) : null
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Quick Actions
              </div>
              {quickActions.map((action, idx) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void navigate({ to: action.path as any });
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                    idx === selectedIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-hover'
                  }`}
                >
                  {action.icon}
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  {idx === selectedIndex && (
                    <CornerDownLeft className="size-3 text-muted shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-4 py-2 text-[11px] text-muted">
          <span>Navigate with <kbd className="rounded border border-border px-1">↑</kbd> <kbd className="rounded border border-border px-1">↓</kbd></span>
          <span>Open with <kbd className="rounded border border-border px-1">↵</kbd></span>
          <span>Close with <kbd className="rounded border border-border px-1">Esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
