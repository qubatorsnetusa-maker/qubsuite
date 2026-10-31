import { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { documentProtection } from './document-protection';

interface DocumentLockScreenProps {
  fileId: string;
  documentTitle: string;
  itemType?: 'Document' | 'Spreadsheet';
  onUnlocked: () => void;
  onBack?: () => void;
}

export function DocumentLockScreen({
  fileId,
  documentTitle,
  itemType = 'Document',
  onUnlocked,
  onBack,
}: DocumentLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = documentProtection.get(fileId);

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter the password');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const isValid = await documentProtection.verify(fileId, password);
      if (isValid) {
        toast.success(`${itemType} unlocked`);
        onUnlocked();
      } else {
        setError('Incorrect password. Please try again.');
        toast.error('Incorrect password');
      }
    } catch {
      setError('Failed to verify password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-56px)] w-full flex-col items-center justify-center bg-slate-50/70 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-500/10 dark:bg-blue-950/60 dark:text-blue-400">
          <Shield className="size-7" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Password Protected {itemType}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Enter the password to access{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            "{documentTitle || `Untitled ${itemType}`}"
          </span>
        </p>

        {config?.hint && (
          <div className="mt-3.5 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
            <span className="font-semibold">Password hint:</span> {config.hint}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUnlock();
          }}
          className="mt-6 space-y-4 text-left"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Enter Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Document password"
                className={`pr-10 h-10 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 shadow-md shadow-blue-500/10"
          >
            <Lock className="size-4" />
            <span>{loading ? 'Verifying...' : `Unlock ${itemType}`}</span>
            <ArrowRight className="size-4" />
          </Button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors py-1"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Drive</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

