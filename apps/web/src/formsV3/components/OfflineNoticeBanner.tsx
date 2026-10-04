import React from 'react';
import { WifiOff, Wifi, HardDrive, X } from 'lucide-react';

interface OfflineNoticeBannerProps {
  isOnline: boolean;
  wasOffline: boolean;
  onDismissWasOffline: () => void;
  onOpenDraftManager: () => void;
}

export function OfflineNoticeBanner({
  isOnline,
  wasOffline,
  onDismissWasOffline,
  onOpenDraftManager,
}: OfflineNoticeBannerProps) {
  // If online and wasn't recently offline, don't show banner
  if (isOnline && !wasOffline) return null;

  if (!isOnline) {
    return (
      <div
        id="banner-offline-mode-active"
        className="bg-amber-500 text-amber-950 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2.5 z-40 border-b border-amber-600/30 shadow-xs select-none"
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-600/20 text-amber-950 flex items-center justify-center shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </span>
          <span>
            <strong>Offline Mode Active:</strong> You can continue editing your form uninterrupted. All questions, themes, and logic rules are safely auto-saved locally.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDraftManager}
            className="px-2.5 py-1 rounded bg-amber-900 hover:bg-black text-white text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
          >
            <HardDrive className="w-3 h-3" />
            <span>View Offline Drafts</span>
          </button>
        </div>
      </div>
    );
  }

  // Was offline and now back online
  return (
    <div
      id="banner-reconnected-online"
      className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center justify-between gap-2 z-40 shadow-xs animate-in fade-in select-none"
    >
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0">
          <Wifi className="w-3.5 h-3.5" />
        </span>
        <span>
          <strong>Back Online:</strong> Connection re-established. Your local form drafts and changes are preserved and synchronized.
        </span>
      </div>
      <button
        type="button"
        onClick={onDismissWasOffline}
        className="text-white/80 hover:text-white p-1 cursor-pointer transition"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
