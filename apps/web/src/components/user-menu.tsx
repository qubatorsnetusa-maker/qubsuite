import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { HardDrive, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-auth';
import { authService } from '@/services/auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/menu';
import { Avatar } from './ui/misc';

export function UserMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full p-1 hover:bg-hover" aria-label={`Account: ${user.name}`}>
          <Avatar user={user} size={34} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="flex flex-col items-center gap-2 px-4 pb-3 pt-2 text-center">
          <Avatar user={user} size={64} />
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<HardDrive />} onSelect={() => void navigate({ to: '/drive' })}>
          Qub Drive
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />} onSelect={() => void navigate({ to: '/settings' })}>
          Account settings
        </DropdownMenuItem>
        {user.platformRole === 'SUPER_ADMIN' && (
          <DropdownMenuItem icon={<ShieldCheck />} onSelect={() => void navigate({ to: '/admin' })}>
            Admin console
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<LogOut />}
          onSelect={async () => {
            await authService.logout();
            qc.clear();
            await navigate({ to: '/login' });
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
