import { type GrantableRole, type RequestAccessInput } from '@qub/shared';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Lock, Send, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NativeSelect, Textarea } from '@/components/ui/form-controls';
import { Avatar } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { driveService } from '@/services/drive';

export interface RequestAccessTarget {
  kind: 'file' | 'folder';
  id: string;
  name: string;
}

export function RequestAccessDialog({
  target,
  onOpenChange,
}: {
  target: RequestAccessTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      {target && (
        <DialogContent title="Request access" className="max-w-[480px]">
          <RequestAccessDialogBody target={target} onClose={() => onOpenChange(false)} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function RequestAccessDialogBody({
  target,
  onClose,
}: {
  target: RequestAccessTarget;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const [role, setRole] = useState<GrantableRole>('EDITOR');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const request = useMutation({
    mutationFn: (input: RequestAccessInput) =>
      driveService.requestAccess(target.kind, target.id, input),
    onSuccess: (res) => {
      setSubmitted(true);
      toast.success(res.message || 'Access request sent to the owner');
      setTimeout(() => onClose(), 1200);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    request.mutate({
      role: role as 'EDITOR' | 'COMMENTER',
      message: message.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="py-6 text-center space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <UserCheck className="size-6" />
        </div>
        <h3 className="text-base font-semibold">Request sent</h3>
        <p className="text-sm text-muted max-w-xs mx-auto">
          The owner has been notified. You will receive an email and notification once your request is approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-2/40 p-3 flex items-center gap-3">
        <Avatar user={me} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{me.name}</p>
          <p className="text-xs text-muted truncate">{me.email}</p>
        </div>
        <span className="text-xs text-muted font-medium bg-surface-2 px-2 py-0.5 rounded">
          You
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          Access level requested
        </label>
        <NativeSelect
          value={role}
          onChange={(e) => setRole(e.target.value as GrantableRole)}
          className="h-10 w-full"
        >
          <option value="EDITOR">Editor (can make edits and changes)</option>
          <option value="COMMENTER">Commenter (can leave comments and feedback)</option>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          Message to the owner <span className="text-muted/60 normal-case font-normal">(optional)</span>
        </label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Let the owner know why you need access to this document..."
          rows={3}
          maxLength={500}
          className="resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="ghost" onClick={onClose} disabled={request.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={request.isPending}
          className="gap-2 font-semibold"
        >
          <Send className="size-4" /> Send request
        </Button>
      </div>
    </form>
  );
}
