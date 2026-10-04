import React from 'react';
import { Monitor, Smartphone, RotateCcw, Lock } from 'lucide-react';
import type { PreviewDevice } from '../types';

interface DevicePreviewFrameProps {
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  onReset?: () => void;
  sharableUrl?: string;
  children: React.ReactNode;
}

export const DevicePreviewFrame: React.FC<DevicePreviewFrameProps> = ({
  device,
  onDeviceChange,
  onReset,
  sharableUrl,
  children,
}) => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Device Viewport Selector Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 shadow-2xs">
          <button
            type="button"
            onClick={() => onDeviceChange('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
              device === 'desktop'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                : 'text-slate-500 hover:text-slate-800 border border-transparent'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => onDeviceChange('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
              device === 'mobile'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,1)]'
                : 'text-slate-500 hover:text-slate-800 border border-transparent'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile (390px)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset form state in preview"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
          <span className="text-[11px] font-mono-code text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200/70">
            {device === 'desktop' ? 'Fluid 100%' : '390 × 760'}
          </span>
        </div>
      </div>

      {/* Frame Container with subtle dot canvas grid */}
      <div className="flex-1 bg-slate-100/80 p-4 sm:p-6 flex items-center justify-center overflow-auto min-h-[500px] relative">
        {device === 'desktop' ? (
          <div className="w-full h-full min-h-[520px] bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/90 overflow-hidden flex flex-col">
            {/* Desktop Mock Browser Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/80 bg-slate-50/90 select-none">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400/90 border border-rose-500/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/90 border border-amber-500/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/90 border border-emerald-500/20" />
              </div>
              <div className="flex-1 max-w-md mx-auto bg-white border border-slate-200/90 rounded-lg text-[11px] font-mono-code text-slate-600 px-3 py-1 flex items-center justify-center gap-1.5 shadow-2xs">
                <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">{sharableUrl || 'qubforms.app/f/live-preview'}</span>
              </div>
              <div className="w-12" /> {/* Balancing spacer */}
            </div>
            {/* Embedded Form */}
            <div className="flex-1 relative">{children}</div>
          </div>
        ) : (
          /* Mobile Phone Mockup */
          <div className="w-[390px] h-[760px] bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-slate-950/25 border-4 border-slate-800/90 ring-1 ring-white/10 flex flex-col relative shrink-0">
            {/* Dynamic Island */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-full z-40 flex items-center justify-between px-3 border border-slate-800/50">
              <div className="w-2 h-2 rounded-full bg-slate-950/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-950/80 ring-1 ring-slate-800" />
            </div>

            {/* Screen Inner Container */}
            <div className="flex-1 bg-white rounded-[38px] overflow-hidden relative flex flex-col">
              {/* Mobile Status Bar */}
              <div className="h-11 w-full flex items-center justify-between px-7 text-[11px] font-semibold text-slate-800 z-30 pt-1 select-none font-mono-code">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[10px]">5G</span>
                  <div className="w-4 h-2 border border-slate-800 rounded-xs relative">
                    <div className="w-3 h-1.5 bg-slate-800 absolute top-0.25 left-0.25 rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* Mobile Content */}
              <div className="flex-1 relative overflow-hidden flex flex-col">{children}</div>

              {/* Home Indicator Bar */}
              <div className="h-5 w-full flex items-center justify-center pb-1.5 bg-transparent z-30 pointer-events-none">
                <div className="w-32 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
