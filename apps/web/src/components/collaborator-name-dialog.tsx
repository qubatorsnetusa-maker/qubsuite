import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { UserCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import type { CurrentUser } from '@qub/shared';

function formatSuggestedName(user: { name?: string; email?: string }): string {
  const emailPart = user.email ? (user.email.split('@')[0] ?? '') : '';
  const raw = (user.name || emailPart || '').trim();
  const cleaned = raw.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function shouldShowDialog(user: CurrentUser | null): boolean {
  if (!user || !user.email) return false;
  const email = user.email;

  try {
    if (localStorage.getItem(`qub_name_confirmed_${user.id}`) === 'true') {
      return false;
    }
  } catch {}

  const urlParams = new URLSearchParams(window.location.search);
  const isCollabInvite = urlParams.get('collab') === '1' || urlParams.get('promptName') === '1';

  const path = window.location.pathname;
  const isDocumentPage =
    path.startsWith('/docs') ||
    path.startsWith('/sheets') ||
    path.startsWith('/forms') ||
    path.startsWith('/drive/file') ||
    path.startsWith('/drive/folder');

  const prefix = (email.split('@')[0] ?? '').trim().toLowerCase();
  const current = (user.name || '').trim().toLowerCase();
  const isProvisionalName = current === prefix || current === '' || current === email.trim().toLowerCase();

  if (isCollabInvite) {
    return true;
  }

  if (isDocumentPage && isProvisionalName) {
    return true;
  }

  return false;
}

export function CollaboratorNameDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && shouldShowDialog(user)) {
      setName(formatSuggestedName(user));
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user]);

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Please enter a name with at least 2 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.updateProfile({ name: trimmed });
      try {
        localStorage.setItem(`qub_name_confirmed_${user.id}`, 'true');
      } catch {}

      // Clean up query parameters without page refresh
      const url = new URL(window.location.href);
      if (url.searchParams.has('collab') || url.searchParams.has('promptName')) {
        url.searchParams.delete('collab');
        url.searchParams.delete('promptName');
        window.history.replaceState({}, '', url.toString());
      }

      setOpen(false);
      toast.success(`Welcome, ${trimmed}! You're ready to collaborate.`);
    } catch (err: any) {
      setError(errorMessage(err) || 'Failed to save name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={() => {}}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background p-7 shadow-2xl border border-border animate-pop-in focus:outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center text-center">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 ring-8 ring-primary/5">
              <UserCheck className="size-6 text-primary" />
            </div>
            <DialogPrimitive.Title className="text-xl font-bold text-foreground">
              Enter your name to collaborate
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted max-w-sm">
              Please indicate your full name so other team members can see who is editing, commenting, and reviewing.
            </DialogPrimitive.Description>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="collab-name-input" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Your Full Name
              </label>
              <Input
                id="collab-name-input"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Jane Doe"
                className="w-full h-11 text-base px-3.5"
                invalid={!!error}
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              <p className="mt-1.5 text-xs text-muted">
                This name will be displayed alongside your live cursors and document edits.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-11 font-semibold flex items-center justify-center gap-2"
              loading={loading}
              disabled={name.trim().length < 2 || loading}
            >
              <span>Continue to document</span>
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
