import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Lock, Unlock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { documentProtection, type ProtectionConfig } from './document-protection';

interface PasswordProtectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  documentTitle: string;
  itemType?: 'document' | 'spreadsheet';
  onProtectionChanged?: (isProtected: boolean) => void;
}

export function PasswordProtectionDialog({
  open,
  onOpenChange,
  fileId,
  documentTitle,
  itemType = 'document',
  onProtectionChanged,
}: PasswordProtectionDialogProps) {
  const [config, setConfig] = useState<ProtectionConfig | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const current = documentProtection.get(fileId);
      setConfig(current);
      setPassword('');
      setConfirmPassword('');
      setHint(current?.hint || '');
    }
  }, [open, fileId]);

  const handleSave = async () => {
    if (!password) {
      toast.error('Please enter a password');
      return;
    }
    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const newConfig = await documentProtection.set(fileId, password, hint, 'open');
      setConfig(newConfig);
      toast.success(`Password protection enabled for "${documentTitle}"`);
      onProtectionChanged?.(true);
      onOpenChange(false);
    } catch {
      toast.error('Failed to enable password protection');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    documentProtection.remove(fileId);
    setConfig(null);
    toast.success(`Password protection removed from "${documentTitle}"`);
    onProtectionChanged?.(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={config?.enabled ? 'Manage Password Protection' : 'Protect with Password'}
        description={`Secure this ${itemType} with a private password.`}
        className="sm:max-w-md"
      >
        {config?.enabled ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <ShieldCheck className="size-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  This {itemType} is currently protected
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Users must enter the correct password to view or edit this file.
                </p>
                {config.hint && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1 italic">
                    Hint: "{config.hint}"
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">Need to change or remove protection?</p>
              <p className="mt-1">
                You can remove the password protection to make this {itemType} accessible to authorized collaborators without a password prompt.
              </p>
            </div>

            <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemove}
                className="gap-1.5"
              >
                <Unlock className="size-3.5" />
                <span>Remove Password</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="size-3.5" /> Security Notice
              </p>
              <p className="mt-0.5">
                Password protected documents require entering this password before contents can be viewed or edited. Keep your password safe.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter document password"
                    className="pr-9"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">
                  Password Hint (Optional)
                </label>
                <Input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="e.g. Project codename + year"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !password.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
              >
                <KeyRound className="size-3.5" />
                <span>{saving ? 'Protecting...' : 'Protect Document'}</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
