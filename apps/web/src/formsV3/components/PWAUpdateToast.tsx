import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

export function PWAUpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateFunction] = useState<(() => Promise<void>) | null>(null);

  const handleUpdate = () => {
    if (updateFunction) {
      updateFunction();
    }
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      id="pwa-update-toast"
      className="fixed bottom-5 right-5 z-50 bg-zinc-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 max-w-sm"
    >
      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
        {needRefresh ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      </div>
      <div className="text-xs min-w-0 flex-1">
        <p className="font-semibold text-zinc-100">
          {needRefresh ? 'Update Available' : 'Ready for Offline Work'}
        </p>
        <p className="text-zinc-400 text-[11px]">
          {needRefresh
            ? 'A new version is ready. Reload to update.'
            : 'Form builder assets cached locally for offline drafting.'}
        </p>
      </div>
      {needRefresh && (
        <button
          type="button"
          onClick={handleUpdate}
          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shrink-0"
        >
          Reload
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
        className="text-zinc-500 hover:text-zinc-300 text-xs p-1 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
