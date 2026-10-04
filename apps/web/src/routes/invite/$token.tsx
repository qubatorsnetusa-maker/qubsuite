import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { authStore } from '@/lib/auth-store';
import { FullPageSpinner, ErrorState } from '@/components/states';
import type { AuthResult } from '@qub/shared';

export const Route = createFileRoute('/invite/$token')({
  component: InviteRedeemPage,
});

function InviteRedeemPage() {
  const { token } = useParams({ from: '/invite/$token' });
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function redeem() {
      try {
        const res = await api<AuthResult & { targetUrl?: string }>('/auth/redeem-invite', {
          method: 'POST',
          body: { token },
        });
        if (!active) return;
        authStore.setSession(res);
        const target = res.targetUrl || '/drive';
        void navigate({ href: target });
      } catch (err) {
        if (!active) return;
        setError(errorMessage(err));
      }
    }
    void redeem();
    return () => {
      active = false;
    };
  }, [token, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
        <ErrorState
          title="Invitation Link Expired or Invalid"
          error={new Error(error)}
          onRetry={() => {
            setError(null);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return <FullPageSpinner label="Opening shared item…" />;
}
