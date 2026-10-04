import React, { useState } from 'react';
import { motion } from '../lib/motion';
import {
  ArrowRight,
  Layers,
  Sparkles,
  Smartphone,
  Monitor,
  CheckCircle2,
  Sliders,
  Keyboard,
  ShieldCheck,
  FolderKanban,
} from 'lucide-react';
import type { FormConfig, PreviewDevice } from '../types';
import { FormRespondent } from './FormRespondent';
import { DevicePreviewFrame } from './DevicePreviewFrame';

interface LandingHeroProps {
  currentForm: FormConfig;
  onLaunchDemo: () => void;
  onOpenBuilder: () => void;
  onOpenWorkspace?: () => void;
  onSelectTemplate: (formId: string) => void;
  availableForms: FormConfig[];
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  currentForm,
  onLaunchDemo,
  onOpenBuilder,
  onOpenWorkspace,
  onSelectTemplate,
  availableForms,
}) => {
  const [heroDevice, setHeroDevice] = useState<PreviewDevice>('desktop');

  return (
    <section className="relative pt-10 pb-16 md:pt-16 md:pb-24 overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-zinc-100/60 via-transparent to-transparent pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Hero Top Copy */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          {/* Subtle announcement pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-zinc-700 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Introducing qub-forms 2.0</span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-500">Pure Typeform-style Flow</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-950 leading-[1.1] mb-6">
            Forms that feel like{' '}
            <span className="underline decoration-zinc-300 underline-offset-8">conversations.</span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto mb-8 font-normal">
            Replace tedious, wall-of-text static forms with focused, one-question-at-a-time flows.
            Featuring fluid kinetic transitions, instant real-time validation, and effortless
            keyboard navigation.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onLaunchDemo}
              className="px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm inline-flex items-center gap-2.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Experience Interactive Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenBuilder}
              className="px-6 py-3.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-800 font-medium text-sm inline-flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-zinc-500" />
              <span>Open Multi-Step Builder</span>
            </button>

            {onOpenWorkspace && (
              <button
                onClick={onOpenWorkspace}
                className="px-5 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 font-medium text-sm inline-flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-zinc-200/60"
              >
                <FolderKanban className="w-4 h-4 text-zinc-600" />
                <span>My Workspace</span>
              </button>
            )}
          </div>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 pt-8 border-t border-zinc-200/80 text-xs text-zinc-600 font-medium">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-700" />
              <span>Kinetic Transitions</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-700" />
              <span>Real-Time Validation</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Keyboard className="w-4 h-4 text-zinc-700" />
              <span>Keyboard-First UX</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4 text-zinc-700" />
              <span>Mobile-Ergonomic</span>
            </div>
          </div>
        </div>

        {/* Live Interactive Hero Sandbox & Viewport Switcher */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {/* Template Quick Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-semibold text-zinc-400 font-mono-code shrink-0">
                ACTIVE TEMPLATE:
              </span>
              {availableForms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectTemplate(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    currentForm.id === f.id
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                  }`}
                >
                  {f.title}
                </button>
              ))}
            </div>

            {/* Viewport device toggle */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setHeroDevice('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  heroDevice === 'desktop'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop View</span>
              </button>
              <button
                type="button"
                onClick={() => setHeroDevice('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  heroDevice === 'mobile'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile View</span>
              </button>
            </div>
          </div>

          {/* Embedded Device Frame with Live Interactive Form */}
          <div className="rounded-2xl border border-zinc-200/80 shadow-xl overflow-hidden bg-zinc-100">
            <DevicePreviewFrame
              device={heroDevice}
              onDeviceChange={setHeroDevice}
            >
              <FormRespondent
                key={`${currentForm.id}-${heroDevice}`}
                form={currentForm}
                isEmbedded={true}
                isMobilePreview={heroDevice === 'mobile'}
              />
            </DevicePreviewFrame>
          </div>
        </div>
      </div>
    </section>
  );
};
