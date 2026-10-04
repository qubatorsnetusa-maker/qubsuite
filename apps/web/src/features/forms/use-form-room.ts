import type { FormClientMessage, FormServerMessage, PresenceUser } from '@qub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/use-auth';
import { ReconnectingSocket } from '@/lib/reconnecting-socket';
import { qk } from '@/services/query-keys';
import { BuilderOpsContext } from './builder/ops/builder-ops';

/**
 * Live builder presence; refreshes the form when someone else changes it, and responses when one arrives.
 * In the builder, a change carrying a transaction id is refetched unless this tab sent it, so a second tab of the
 * same user sees the first tab's edits. Elsewhere, and for changes without an id, only other users' changes refetch.
 */
export function useFormRoom(formId: string) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const ops = useContext(BuilderOpsContext);
  const isOwnTx = useRef(ops?.isOwnTx);
  isOwnTx.current = ops?.isOwnTx;
  useEffect(() => {
    const socket = new ReconnectingSocket<FormServerMessage, FormClientMessage>({
      path: `/forms/${formId}`,
      onMessage: (msg) => {
        if (msg.type === 'presence') setUsers(msg.users.filter((u) => u.id !== me.id));
        if (msg.type === 'formUpdated') {
          const own = msg.txId && isOwnTx.current ? isOwnTx.current(msg.txId) : msg.by === me.id;
          // The form itself and the responses summary (its question labels and cards follow the form), for every
          // period (`qk.forms.analytics(id, days)`) — but not the responses list: a prefix match on the form's key
          // would also refetch every loaded responses page on each remote edit.
          if (!own) {
            void qc.invalidateQueries({ queryKey: qk.forms.one(formId), exact: true });
            void qc.invalidateQueries({ queryKey: [...qk.forms.one(formId), 'analytics'] });
          }
        }
        if (msg.type === 'response') {
          toast.success('New response received');
          void qc.invalidateQueries({ queryKey: ['forms', formId] });
        }
      },
    });
    return () => socket.close();
  }, [formId, qc, me.id]);
  return users;
}
