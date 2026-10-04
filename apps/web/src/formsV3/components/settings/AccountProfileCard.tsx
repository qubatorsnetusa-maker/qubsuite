import { ShieldCheck } from 'lucide-react';

interface AccountProfileCardProps {
  userName: string;
  userEmail: string;
}

export function AccountProfileCard({ userName, userEmail }: AccountProfileCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
      <h2 className="font-headline-sm text-sm font-bold text-slate-900 mb-4">Profile</h2>
      <div className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-indigo-600/20 ring-4 ring-indigo-100/80 shrink-0 uppercase select-none">
          {userName.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
          <p className="text-xs text-slate-500 truncate">{userEmail}</p>
        </div>
      </div>
      <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-3">
        <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Your name and email are managed by Qubator SSO and shared across every Qubator app you
          use. To change them, update your account on Qubator SSO.
        </p>
      </div>
    </section>
  );
}
