import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { authService } from '@/services/auth';
import { qk } from '@/services/query-keys';
import { KingsChatPopupError, kingslogin } from './kingschat';

/** "Continue with KingsChat": hidden unless the server has KingsChat sign-in configured. */
export function KingsChatButton({ onSignedIn, onError }: { onSignedIn(): void; onError(message: string | null): void }) {
  const providers = useQuery({ queryKey: qk.authProviders, queryFn: authService.providers, staleTime: Infinity });
  const [busy, setBusy] = useState(false);
  const kc = providers.data?.kingschat;
  if (!kc) return null;

  const start = async () => {
    onError(null);
    setBusy(true);
    try {
      const tokens = await kingslogin({ clientId: kc.clientId, scopes: ['profile'] }, kc.environment);
      console.log('[KingsChatButton] Received tokens from popup:', tokens);
      await authService.kingschat(tokens.accessToken);
      onSignedIn();
    } catch (err) {
      console.error('[KingsChatButton] Sign-in error details:', err);
      // Closing the popup is a choice, not an error.
      if (!(err instanceof KingsChatPopupError && err.reason === 'closed')) onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="lg" className="w-full" loading={busy} onClick={() => void start()}>
        Continue with KingsChat
      </Button>
      <div className="my-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
