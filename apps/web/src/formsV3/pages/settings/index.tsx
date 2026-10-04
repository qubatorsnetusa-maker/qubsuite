import { useRouter } from '@tanstack/react-router';
import { logoutFn } from '@/formsV3/api/auth';
import type { UserPreferences } from '@/formsV3/api/preferences';
import { Footer } from '../../components/Footer';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { AccountProfileCard } from '../../components/settings/AccountProfileCard';
import { PreferencesCard } from '../../components/settings/PreferencesCard';
import { SessionCard } from '../../components/settings/SessionCard';

interface SettingsPageProps {
  userName: string;
  userEmail: string;
  preferences: UserPreferences;
}

export function SettingsPage({ userName, userEmail, preferences }: SettingsPageProps) {
  const router = useRouter();
  const logout = logoutFn;

  const handleSignOut = async () => {
    await logout();
    await router.invalidate();
    await router.navigate({ to: '/login' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      <SettingsHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-5">
        <AccountProfileCard userName={userName} userEmail={userEmail} />
        <PreferencesCard preferences={preferences} />
        <SessionCard userEmail={userEmail} onSignOut={handleSignOut} />
      </main>
      <Footer />
    </div>
  );
}
