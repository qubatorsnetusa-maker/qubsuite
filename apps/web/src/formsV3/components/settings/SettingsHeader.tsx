import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

export function SettingsHeader() {
  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link
          to={'/formsv3' as any}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          title="Back to workspace"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-headline-sm text-lg font-bold tracking-tight text-slate-900">
          Account Settings
        </h1>
      </div>
    </div>
  );
}
