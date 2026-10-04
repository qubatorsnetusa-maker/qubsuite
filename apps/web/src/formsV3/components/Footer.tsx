import React from 'react';
import { Sparkles, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white/80 backdrop-blur-md border-t border-zinc-200/80 py-8 text-zinc-500 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-zinc-600">
          <div className="w-5 h-5 rounded-md bg-zinc-900 text-white flex items-center justify-center font-mono-code font-bold text-[10px] shadow-2xs select-none">
            ::
          </div>
          <span className="font-bold text-zinc-900 tracking-tight">Qub Forms</span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-500 font-medium">Conversational Form Engine</span>
        </div>

        <div className="flex items-center flex-wrap justify-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-mono-code text-[10px] text-zinc-700 shadow-2xs font-semibold">↵ Enter</kbd>
            <span className="text-zinc-400">advance</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-mono-code text-[10px] text-zinc-700 shadow-2xs font-semibold">⇧ Shift+↵</kbd>
            <span className="text-zinc-400">newline</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-mono-code text-[10px] text-zinc-700 shadow-2xs font-semibold">A-D</kbd>
            <span className="text-zinc-400">choices</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-mono-code text-[10px] text-zinc-700 shadow-2xs font-semibold">1-9</kbd>
            <span className="text-zinc-400">rating</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
