import { LogOut } from 'lucide-react';

interface SessionCardProps {
  userEmail: string;
  onSignOut: () => void;
}

export function SessionCard({ userEmail, onSignOut }: SessionCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
      <h2 className="font-headline-sm text-sm font-bold text-slate-900 mb-1">Session</h2>
      <p className="text-xs text-slate-500 mb-4">
        You&apos;re signed in as <span className="font-medium text-slate-700">{userEmail}</span>.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition cursor-pointer active:scale-[0.98] border border-rose-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign out</span>
      </button>
    </section>
  );
}
