import { Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { FieldError } from '@/components/ui/form-controls';
import { errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import type { InputProps } from './types';

export function FileInput({ field, onChange, color, uploaded, onUploaded, upload, disabled }: InputProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maxFiles = field.settings.maxFiles ?? 1;
  const setList = (list: typeof uploaded) => {
    onUploaded(list);
    onChange(list.length ? list.map((x) => x.id) : null);
  };
  return (
    <div className="space-y-2">
      {uploaded.map((u) => (
        <div key={u.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <Paperclip className="size-4 text-muted" /> <span className="flex-1 truncate">{u.name}</span>
          <span className="text-xs text-muted">{formatBytes(u.size)}</span>
          <button type="button" onClick={() => setList(uploaded.filter((x) => x.id !== u.id))} aria-label={`Remove ${u.name}`}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      {!upload ? (
        <p className="text-sm text-muted">File uploads are available to respondents on the live form.</p>
      ) : (
        uploaded.length < maxFiles && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-hover" style={{ color }}>
            <Paperclip className="size-4" /> {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : 'Add file'}
            <input
              type="file"
              hidden
              disabled={disabled || progress !== null}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setError(null);
                setProgress(0);
                try {
                  const meta = await upload(field.id, file, setProgress);
                  setList([...uploaded, meta]);
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setProgress(null);
                }
              }}
            />
          </label>
        )
      )}
      <p className="text-xs text-muted">
        Up to {maxFiles} file{maxFiles > 1 ? 's' : ''}, {field.settings.maxFileSizeMb ?? 10} MB each{field.settings.allowedFileTypes?.length ? ` · ${field.settings.allowedFileTypes.join(', ')}` : ''}
      </p>
      <FieldError message={error ?? undefined} />
    </div>
  );
}
