import React from 'react';
import { Sparkles, Layers, Play, Inbox, Plus, ArrowUpRight, FolderKanban, WifiOff, Wifi } from 'lucide-react';
import type { ActiveView } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NavbarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  submissionsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigate,
  submissionsCount,
}) => {
  const { isOnline } = useNetworkStatus();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-mono-code font-bold text-sm tracking-tighter group-hover:bg-zinc-800 transition shadow-xs">
            ::
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-zinc-900 font-sans">
              qub-forms
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-mono-code border border-zinc-200/60 font-medium">
              typeform clone
            </span>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                <WifiOff className="w-3 h-3 text-amber-700" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeView === 'landing'
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            Overview
          </button>

          <button
            type="button"
            id="nav-tab-workspace"
            onClick={() => onNavigate('workspace')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeView === 'workspace'
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('builder')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeView === 'builder'
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Builder</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('fullscreen_demo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeView === 'fullscreen_demo'
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Interactive Demo</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('submissions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition relative ${
              activeView === 'submissions'
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Responses</span>
            {submissionsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[10px] flex items-center justify-center font-bold">
                {submissionsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Direct Action */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => onNavigate('builder')}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold tracking-tight transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Form</span>
          </button>
        </div>
      </div>
    </header>
  );
};
