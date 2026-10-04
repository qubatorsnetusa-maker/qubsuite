import React from 'react';
import {
  Layers,
  Sparkles,
  ShieldAlert,
  Smartphone,
  CheckCircle,
  Command,
  Zap,
  MousePointerClick,
} from 'lucide-react';

export const FeatureGrid: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-white border-y border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400 font-mono-code block mb-3">
            Architectural Philosophy
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
            Engineered for completion, not just collection.
          </h2>
          <p className="mt-4 text-zinc-600 text-base leading-relaxed">
            Traditional web forms suffer up to 80% abandonment due to cognitive fatigue.
            qub-forms is architected from the ground up to present questions with conversational
            warmth and zero distraction.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 transition flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-5 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Fluid Kinetic Transitions
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Powered by calibrated motion springs. Smooth vertical choreography guides the user’s
                attention effortlessly from one thought to the next.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-200/60 flex items-center gap-1.5 text-xs font-mono-code text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Physics-based dampening</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 transition flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-5 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Real-Time Inline Validation
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Instant error detection before progression. Catches malformed emails, short inputs,
                and missing required answers with subtle tactile cues.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-200/60 flex items-center gap-1.5 text-xs font-mono-code text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Regex & min-length logic</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 transition flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-5 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Multi-Step Visual Builder
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Drag, reorder, duplicate, and configure question types with instant live preview in
                both desktop and mobile device viewports side-by-side.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-200/60 flex items-center gap-1.5 text-xs font-mono-code text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Live state synchronization</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 transition flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-5 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Mobile-First Touch Ergonomics
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Generous touch targets (48px+), virtual keyboard safe padding, and dedicated bottom
                action controls tailored specifically for one-handed mobile use.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-200/60 flex items-center gap-1.5 text-xs font-mono-code text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Thumb-zone optimized</span>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-16 rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50/30">
          <div className="p-6 sm:p-8 border-b border-zinc-200">
            <h3 className="text-xl font-bold text-zinc-900">
              qub-forms vs. Traditional Static Forms
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Why leading product teams switch to conversational multi-step interfaces.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100/70 text-zinc-700 font-semibold border-b border-zinc-200 text-xs uppercase tracking-wider font-mono-code">
                <tr>
                  <th className="py-3 px-6">Dimension</th>
                  <th className="py-3 px-6 text-emerald-800 bg-emerald-50/60">
                    qub-forms Conversational
                  </th>
                  <th className="py-3 px-6 text-zinc-500">Standard Static Web Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                <tr>
                  <td className="py-4 px-6 font-medium">Cognitive Load</td>
                  <td className="py-4 px-6 bg-emerald-50/30 font-medium text-emerald-900">
                    Zero overwhelm — 1 question at a time
                  </td>
                  <td className="py-4 px-6 text-zinc-500">
                    High — 15 fields stacked on one endless page
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Validation Feedback</td>
                  <td className="py-4 px-6 bg-emerald-50/30 font-medium text-emerald-900">
                    Instant inline guidance before moving forward
                  </td>
                  <td className="py-4 px-6 text-zinc-500">
                    Scroll back up to find 4 red errors after clicking Submit
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Keyboard Efficiency</td>
                  <td className="py-4 px-6 bg-emerald-50/30 font-medium text-emerald-900">
                    Full keyboard navigation (Enter, Tab, A/B/C/D shortcuts)
                  </td>
                  <td className="py-4 px-6 text-zinc-500">
                    Requires constant mouse clicking and manual tabbing
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Mobile Experience</td>
                  <td className="py-4 px-6 bg-emerald-50/30 font-medium text-emerald-900">
                    Responsive viewport, thumb-accessible next controls
                  </td>
                  <td className="py-4 px-6 text-zinc-500">
                    Pinching, zooming, accidental page zooms
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
