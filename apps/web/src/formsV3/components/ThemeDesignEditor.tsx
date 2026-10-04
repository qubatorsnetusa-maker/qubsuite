import React, { useState } from 'react';
import {
  Palette,
  Sparkles,
  Sliders,
  Layers,
  Image as ImageIcon,
  Grid,
  Sun,
  Eye,
  Check,
  RotateCcw,
  Maximize2,
  Type,
  Square,
  Circle,
  ChevronRight,
  CheckCircle2,
  Wand2,
  Paintbrush,
  ArrowRight,
} from 'lucide-react';
import type {
  FormConfig,
  FormTheme,
  CustomColorPalette,
  BackgroundDesignConfig,
  BackgroundPattern,
  BackgroundGradient,
  BackgroundDesignType,
  BackgroundBlur,
  BackgroundFit,
  FormFontFamily,
  FormBorderRadius,
} from '../types';
import { FORM_THEMES } from '../data/defaultForms';
import {
  FONT_OPTIONS,
  BORDER_RADIUS_OPTIONS,
  CURATED_PRIMARY_COLORS,
  resolveFormThemeValues,
} from '../data/themePresets';

interface ThemeDesignEditorProps {
  form: FormConfig;
  onUpdateForm: (updated: Partial<FormConfig>) => void;
}

// Curated Designer Color Palettes for instant 1-click styling
export const CURATED_DESIGNER_PALETTES: {
  name: string;
  palette: CustomColorPalette;
}[] = [
  {
    name: 'Cyber Indigo',
    palette: {
      enabled: true,
      primaryColorHex: '#6366F1',
      backgroundColorHex: '#0B0F19',
      textColorHex: '#F8FAFC',
      cardBgColorHex: '#141C2E',
      borderRadius: 'rounded-xl',
      fontFamily: 'space-grotesk',
    },
  },
  {
    name: 'Sunset Amber',
    palette: {
      enabled: true,
      primaryColorHex: '#EA580C',
      backgroundColorHex: '#FFFDF9',
      textColorHex: '#261E14',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-2xl',
      fontFamily: 'fraunces',
    },
  },
  {
    name: 'Forest Emerald',
    palette: {
      enabled: true,
      primaryColorHex: '#059669',
      backgroundColorHex: '#F2F9F5',
      textColorHex: '#132E22',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-xl',
      fontFamily: 'outfit',
    },
  },
  {
    name: 'Nordic Slate',
    palette: {
      enabled: true,
      primaryColorHex: '#0F172A',
      backgroundColorHex: '#F8FAFC',
      textColorHex: '#0F172A',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-xl',
      fontFamily: 'inter',
    },
  },
  {
    name: 'Cherry Blossom',
    palette: {
      enabled: true,
      primaryColorHex: '#E11D48',
      backgroundColorHex: '#FFF5F7',
      textColorHex: '#3B0D18',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-2xl',
      fontFamily: 'playfair',
    },
  },
  {
    name: 'Midnight Gold',
    palette: {
      enabled: true,
      primaryColorHex: '#F59E0B',
      backgroundColorHex: '#121316',
      textColorHex: '#F3F4F6',
      cardBgColorHex: '#1C1E24',
      borderRadius: 'rounded-xl',
      fontFamily: 'lora',
    },
  },
  {
    name: 'Pacific Azure',
    palette: {
      enabled: true,
      primaryColorHex: '#0284C7',
      backgroundColorHex: '#F0F9FF',
      textColorHex: '#082F49',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-xl',
      fontFamily: 'plus-jakarta',
    },
  },
  {
    name: 'Electric Violet',
    palette: {
      enabled: true,
      primaryColorHex: '#9333EA',
      backgroundColorHex: '#FAF5FF',
      textColorHex: '#2E1065',
      cardBgColorHex: '#FFFFFF',
      borderRadius: 'rounded-full',
      fontFamily: 'outfit',
    },
  },
];

// Curated Wallpaper Presets
export const CURATED_WALLPAPERS: { name: string; url: string }[] = [
  {
    name: 'Atmospheric Fog',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Minimal Architecture',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Abstract Fluid',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Neon Cyberpunk',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Warm Geometry',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
  },
];

type ThemeSubTab = 'colors' | 'typography' | 'radius' | 'background' | 'presets';

export const ThemeDesignEditor: React.FC<ThemeDesignEditorProps> = ({
  form,
  onUpdateForm,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ThemeSubTab>('colors');

  // Resolved theme values
  const themeValues = resolveFormThemeValues(form);
  const activePrimaryColor = themeValues.primaryColor;
  const activeFontFamily = themeValues.fontFamily;
  const activeBorderRadius = themeValues.borderRadius;

  // FONT_OPTIONS / BORDER_RADIUS_OPTIONS (src/data/themePresets.ts) are
  // non-empty static lists.
  const currentFontOption =
    FONT_OPTIONS.find((f) => f.id === activeFontFamily) || FONT_OPTIONS[0]!;
  const currentRadiusOption =
    BORDER_RADIUS_OPTIONS.find((r) => r.id === activeBorderRadius) || BORDER_RADIUS_OPTIONS[3]!;

  const customPalette = form.customPalette || {
    enabled: false,
    primaryColorHex: activePrimaryColor,
    backgroundColorHex: '#FDFBF7',
    textColorHex: '#18181B',
    cardBgColorHex: '#FFFFFF',
    borderRadius: activeBorderRadius,
    fontFamily: activeFontFamily,
  };

  const bgDesign: BackgroundDesignConfig = form.backgroundDesign || {
    type: form.backgroundImage ? 'image' : 'solid',
    imageUrl: form.backgroundImage,
    imageOpacity: form.backgroundOpacity ?? 0.25,
    imageBlur: form.backgroundBlur ?? 'none',
    imageFit: form.backgroundFit ?? 'cover',
    pattern: 'dots',
    patternOpacity: 0.12,
    gradientPreset: 'linear-mesh',
    gradientDirection: 'to-br',
    overlayDarkness: 0,
    ambientGlow: false,
  };

  // Handlers for primary color, font family, and border radius
  const handleUpdatePrimaryColor = (hex: string) => {
    onUpdateForm({
      primaryColor: hex,
      customPalette: {
        ...customPalette,
        enabled: true,
        primaryColorHex: hex,
      },
      updatedAt: 'Just now',
    });
  };

  const handleUpdateFontFamily = (fontId: FormFontFamily) => {
    onUpdateForm({
      fontFamily: fontId,
      customPalette: {
        ...customPalette,
        enabled: true,
        fontFamily: fontId,
      },
      updatedAt: 'Just now',
    });
  };

  const handleUpdateBorderRadius = (radiusId: FormBorderRadius) => {
    onUpdateForm({
      borderRadius: radiusId,
      customPalette: {
        ...customPalette,
        enabled: true,
        borderRadius: radiusId,
      },
      updatedAt: 'Just now',
    });
  };

  const handleUpdateCustomPalette = (updates: Partial<CustomColorPalette>) => {
    onUpdateForm({
      customPalette: {
        ...customPalette,
        ...updates,
      },
      ...(updates.primaryColorHex ? { primaryColor: updates.primaryColorHex } : {}),
      ...(updates.borderRadius ? { borderRadius: updates.borderRadius } : {}),
      ...(updates.fontFamily ? { fontFamily: updates.fontFamily } : {}),
      updatedAt: 'Just now',
    });
  };

  const handleUpdateBgDesign = (updates: Partial<BackgroundDesignConfig>) => {
    const nextBg = { ...bgDesign, ...updates };
    onUpdateForm({
      backgroundDesign: nextBg,
      backgroundImage: nextBg.type === 'image' ? nextBg.imageUrl : undefined,
      backgroundOpacity: nextBg.imageOpacity,
      backgroundBlur: nextBg.imageBlur,
      backgroundFit: nextBg.imageFit,
      updatedAt: 'Just now',
    });
  };

  const handleResetToDefaults = () => {
    onUpdateForm({
      primaryColor: '#18181B',
      fontFamily: 'plus-jakarta',
      borderRadius: 'rounded-xl',
      themeId: 'nordic-paper',
      customPalette: {
        enabled: false,
        primaryColorHex: '#18181B',
        backgroundColorHex: '#FDFBF7',
        textColorHex: '#18181B',
        cardBgColorHex: '#FFFFFF',
        borderRadius: 'rounded-xl',
        fontFamily: 'plus-jakarta',
      },
      updatedAt: 'Just now',
    });
  };

  return (
    <div className="space-y-5 pb-8 text-slate-800">
      {/* HEADER & REAL-TIME THEME PREVIEW CARD */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-400" />
            <h2 className="font-headline-sm text-xs font-bold uppercase tracking-wider text-slate-200">
              Theme Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            title="Reset theme styling to standard defaults"
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer px-2 py-0.5 rounded hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Live Visual Preview of Applied Theme Attributes */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-3">
          <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
            <span className="font-mono-code text-[10px] text-slate-400 uppercase tracking-wide">
              Live Theme Preview
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Real-time sync</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {/* Primary Color Badge */}
            <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700/50 flex flex-col items-center justify-center gap-1">
              <div
                className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                style={{ backgroundColor: activePrimaryColor }}
              />
              <span className="font-mono-code text-[10px] text-slate-300 uppercase truncate max-w-full">
                {activePrimaryColor}
              </span>
              <span className="text-[9px] text-slate-500">Primary Color</span>
            </div>

            {/* Font Family Badge */}
            <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700/50 flex flex-col items-center justify-center gap-0.5">
              <span
                className="text-xs font-bold text-white truncate max-w-full"
                style={{ fontFamily: currentFontOption.cssFont }}
              >
                Aa Bb
              </span>
              <span className="text-[10px] font-medium text-slate-300 truncate max-w-full">
                {currentFontOption.name}
              </span>
              <span className="text-[9px] text-slate-500">Font Family</span>
            </div>

            {/* Border Radius Badge */}
            <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700/50 flex flex-col items-center justify-center gap-1">
              <div
                className={`w-4 h-4 bg-slate-700 border border-slate-500 ${currentRadiusOption.tailwindClass}`}
              />
              <span className="text-[10px] font-medium text-slate-300">
                {currentRadiusOption.name} ({currentRadiusOption.cssValue})
              </span>
              <span className="text-[9px] text-slate-500">Border Radius</span>
            </div>
          </div>

          {/* Interactive Form Element Sample with applied theme */}
          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Sample Button:</span>
            <button
              type="button"
              className={`px-4 py-1.5 text-xs font-medium text-white shadow-sm inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${currentRadiusOption.tailwindClass}`}
              style={{
                backgroundColor: activePrimaryColor,
                fontFamily: currentFontOption.cssFont,
              }}
            >
              <span>Submit Response</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* THEME NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium overflow-x-auto">
        <button
          type="button"
          id="subtab-primary-color"
          onClick={() => setActiveSubTab('colors')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
            activeSubTab === 'colors'
              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-indigo-600" />
          <span>Primary Colors</span>
        </button>
        <button
          type="button"
          id="subtab-font-family"
          onClick={() => setActiveSubTab('typography')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
            activeSubTab === 'typography'
              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-purple-600" />
          <span>Font Families</span>
        </button>
        <button
          type="button"
          id="subtab-border-radius"
          onClick={() => setActiveSubTab('radius')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
            activeSubTab === 'radius'
              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Square className="w-3.5 h-3.5 text-amber-600" />
          <span>Border Radius</span>
        </button>
        <button
          type="button"
          id="subtab-background-canvas"
          onClick={() => setActiveSubTab('background')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
            activeSubTab === 'background'
              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Background</span>
        </button>
        <button
          type="button"
          id="subtab-theme-presets"
          onClick={() => setActiveSubTab('presets')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
            activeSubTab === 'presets'
              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Presets</span>
        </button>
      </div>

      {/* SUB-PANEL 1: PRIMARY COLORS SETTINGS */}
      {activeSubTab === 'colors' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-600" />
                <span>Primary Accent Color</span>
              </label>
              <span className="text-[11px] font-mono-code text-slate-500 uppercase">
                {activePrimaryColor}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Sets the focal color applied to call-to-action buttons, active inputs, step progress,
              and highlighted options.
            </p>

            {/* Custom Color Input & Color Picker */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="relative">
                <input
                  type="color"
                  id="primary-color-picker"
                  value={activePrimaryColor.startsWith('#') ? activePrimaryColor : '#18181B'}
                  onChange={(e) => handleUpdatePrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5 bg-white shadow-2xs"
                  title="Choose custom hex color"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase font-mono-code text-slate-400 mb-0.5">
                  Hex Color Code
                </div>
                <input
                  type="text"
                  id="primary-color-hex-input"
                  value={activePrimaryColor}
                  onChange={(e) => handleUpdatePrimaryColor(e.target.value)}
                  placeholder="#18181B"
                  className="w-full text-xs font-mono-code font-bold uppercase px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-800 outline-none focus:border-indigo-600"
                />
              </div>
              <div
                className="w-8 h-8 rounded-lg border border-black/10 shadow-2xs shrink-0 flex items-center justify-center text-white"
                style={{ backgroundColor: activePrimaryColor }}
              >
                <Check className="w-4 h-4 text-white drop-shadow-xs" />
              </div>
            </div>
          </div>

          {/* Curated Color Swatches */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-2">
              Curated Designer Palettes
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CURATED_PRIMARY_COLORS.map((color) => {
                const isSelected = activePrimaryColor.toLowerCase() === color.hex.toLowerCase();
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => handleUpdatePrimaryColor(color.hex)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/10 bg-indigo-50 shadow-2xs font-semibold'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-black/10 shadow-2xs shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: color.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                    </div>
                    <div className="truncate min-w-0">
                      <div className="text-[11px] text-slate-800 font-medium truncate">
                        {color.name}
                      </div>
                      <div className="text-[9px] font-mono-code text-slate-400 uppercase">
                        {color.hex}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Element Mockup using Primary Color */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
            <span className="block text-[11px] font-semibold text-slate-700">
              Primary Accent in Action
            </span>
            <div className="space-y-2 text-xs">
              {/* Progress bar preview */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Question 2 of 4</span>
                  <span>50%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: '50%', backgroundColor: activePrimaryColor }}
                  />
                </div>
              </div>

              {/* Action button preview */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className={`px-4 py-2 text-xs font-semibold text-white transition cursor-pointer shadow-xs ${currentRadiusOption.tailwindClass}`}
                  style={{ backgroundColor: activePrimaryColor }}
                >
                  Next Question ↵
                </button>
                <div
                  className={`px-3 py-1.5 border text-xs font-medium ${currentRadiusOption.tailwindClass}`}
                  style={{
                    borderColor: activePrimaryColor,
                    color: activePrimaryColor,
                    backgroundColor: `${activePrimaryColor}10`,
                  }}
                >
                  Selected Choice
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PANEL 2: FONT FAMILIES SETTINGS */}
      {activeSubTab === 'typography' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-purple-600" />
                <span>Form Font Families</span>
              </label>
              <span className="text-[11px] font-mono-code text-slate-500">
                {currentFontOption.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Choose a typography style that best aligns with your brand voice. All fonts are
              automatically loaded with high-fidelity rendering across all devices.
            </p>
          </div>

          {/* Font Family Cards Grid */}
          <div className="space-y-2.5">
            {FONT_OPTIONS.map((font) => {
              const isSelected = activeFontFamily === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  id={`btn-select-font-${font.id}`}
                  onClick={() => handleUpdateFontFamily(font.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-600/10 bg-indigo-50/80 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{font.name}</span>
                      <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {font.category}
                      </span>
                    </div>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-600/20">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono-code">{font.badge}</span>
                    )}
                  </div>

                  {/* Live Rendered Sample in this font */}
                  <div
                    className="p-2.5 rounded-lg bg-white border border-slate-100 space-y-1"
                    style={{ fontFamily: font.cssFont }}
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {font.headingSample}
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      {font.bodySample}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-PANEL 3: BORDER RADIUS SETTINGS */}
      {activeSubTab === 'radius' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Square className="w-3.5 h-3.5 text-amber-600" />
                <span>Corner Border Radius</span>
              </label>
              <span className="text-[11px] font-mono-code text-slate-500">
                {currentRadiusOption.name} ({currentRadiusOption.cssValue})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Controls the corner curvature applied uniformly across buttons, choice cards, inputs,
              and interactive respondent controls.
            </p>
          </div>

          {/* Border Radius Options List */}
          <div className="space-y-2">
            {BORDER_RADIUS_OPTIONS.map((radius) => {
              const isSelected = activeBorderRadius === radius.id;
              return (
                <button
                  key={radius.id}
                  type="button"
                  id={`btn-select-radius-${radius.id}`}
                  onClick={() => handleUpdateBorderRadius(radius.id)}
                  className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-600/10 bg-indigo-50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Visual Corner Indicator */}
                    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center p-1">
                      <div
                        className={`w-5 h-5 bg-slate-800 border border-slate-900 ${radius.tailwindClass}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{radius.name}</span>
                        <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {radius.cssValue}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {radius.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-medium text-white px-2.5 py-1 ${radius.tailwindClass}`}
                      style={{ backgroundColor: activePrimaryColor }}
                    >
                      Button
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-PANEL 4: BACKGROUND & CANVAS */}
      {activeSubTab === 'background' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Canvas Background & Patterns</span>
              </label>
              <span className="text-[10px] uppercase font-mono-code font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {bgDesign.type}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Configure canvas colors, gradients, subtle geometric patterns, or custom wallpapers.
            </p>
          </div>

          {/* Design Type Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium">
            {(
              [
                { id: 'solid', label: 'Solid' },
                { id: 'gradient', label: 'Gradient' },
                { id: 'pattern', label: 'Pattern' },
                { id: 'image', label: 'Image' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                id={`btn-bg-type-${item.id}`}
                onClick={() => handleUpdateBgDesign({ type: item.id })}
                className={`py-1.5 rounded-lg transition cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset ${
                  bgDesign.type === item.id
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Solid Canvas Color Controls */}
          {bgDesign.type === 'solid' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700">
                Solid Canvas Color
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Paper', hex: '#FDFBF7' },
                  { label: 'White', hex: '#FFFFFF' },
                  { label: 'Slate', hex: '#0B0F19' },
                  { label: 'Obsidian', hex: '#111215' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      handleUpdateCustomPalette({
                        backgroundColorHex: item.hex,
                        textColorHex:
                          item.hex === '#FFFFFF' || item.hex === '#FDFBF7'
                            ? '#18181B'
                            : '#F4F4F5',
                      })
                    }
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-xs text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: item.hex }}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gradient Mesh Controls */}
          {bgDesign.type === 'gradient' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700">
                Gradient Mesh Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'linear-mesh', name: 'Mesh Aura' },
                    { id: 'sunset-glow', name: 'Sunset Glow' },
                    { id: 'aurora-borealis', name: 'Northern Lights' },
                    { id: 'soft-pastel', name: 'Soft Pastel' },
                    { id: 'midnight-nebula', name: 'Midnight Nebula' },
                    { id: 'cyber-violet', name: 'Cyber Violet' },
                    { id: 'mint-fresh', name: 'Fresh Mint' },
                    { id: 'ocean-depth', name: 'Ocean Depth' },
                  ] as const
                ).map((grad) => (
                  <button
                    key={grad.id}
                    type="button"
                    onClick={() => handleUpdateBgDesign({ gradientPreset: grad.id })}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      bgDesign.gradientPreset === grad.id
                        ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600/10 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white/70'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-black/10"
                      style={{
                        background:
                          grad.id === 'sunset-glow'
                            ? 'linear-gradient(135deg, #f97316, #ec4899)'
                            : grad.id === 'aurora-borealis'
                            ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                            : grad.id === 'midnight-nebula'
                            ? 'linear-gradient(135deg, #312e81, #1e1b4b)'
                            : grad.id === 'cyber-violet'
                            ? 'linear-gradient(135deg, #8b5cf6, #d946ef)'
                            : grad.id === 'mint-fresh'
                            ? 'linear-gradient(135deg, #34d399, #6ee7b7)'
                            : grad.id === 'ocean-depth'
                            ? 'linear-gradient(135deg, #0284c7, #0f172a)'
                            : 'linear-gradient(135deg, #e0e7ff, #fce7f3)',
                      }}
                    />
                    <span className="text-[11px] font-medium text-slate-800 truncate">
                      {grad.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pattern Controls */}
          {bgDesign.type === 'pattern' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700">
                Geometric Patterns
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    'dots',
                    'grid',
                    'blueprint',
                    'isometric',
                    'diagonal-stripes',
                    'crosses',
                    'waves',
                    'subtle-noise',
                  ] as const
                ).map((pat) => (
                  <button
                    key={pat}
                    type="button"
                    onClick={() => handleUpdateBgDesign({ pattern: pat })}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer capitalize text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      bgDesign.pattern === pat
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white/70 text-slate-700'
                    }`}
                  >
                    {pat.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Wallpaper Controls */}
          {bgDesign.type === 'image' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700">
                Curated Wallpapers
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CURATED_WALLPAPERS.map((wall) => (
                  <button
                    key={wall.name}
                    type="button"
                    onClick={() => handleUpdateBgDesign({ imageUrl: wall.url })}
                    className={`group relative h-16 rounded-lg overflow-hidden border transition cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      bgDesign.imageUrl === wall.url
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <img
                      src={wall.url}
                      alt={wall.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white drop-shadow bg-black/40 px-1 rounded">
                      {wall.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-PANEL 5: THEME PRESETS */}
      {activeSubTab === 'presets' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Designer Theme Presets</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              1-click presets that configure harmonious primary colors, font families, and border
              radii together.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CURATED_DESIGNER_PALETTES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  handleUpdateCustomPalette({
                    ...preset.palette,
                    enabled: true,
                  })
                }
                className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/50 text-left transition cursor-pointer flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                  <div className="flex items-center -space-x-1">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.palette.primaryColorHex }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-2xs"
                      style={{ backgroundColor: preset.palette.backgroundColorHex }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono-code">
                  <span>{preset.palette.fontFamily || 'sans'}</span>
                  <span>•</span>
                  <span>{preset.palette.borderRadius || 'rounded-xl'}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Baseline Classic Themes */}
          <div className="pt-3 border-t border-slate-200">
            <span className="block text-[11px] font-semibold text-slate-700 mb-2">
              Classic Template Themes
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORM_THEMES.map((theme) => {
                const isCurrent = form.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() =>
                      onUpdateForm({
                        themeId: theme.id,
                        primaryColor: theme.primaryColorHex,
                        customPalette: { ...customPalette, enabled: false },
                        updatedAt: 'Just now',
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                      isCurrent
                        ? 'border-indigo-600 ring-2 ring-indigo-600/10 bg-indigo-50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: theme.primaryColorHex }}
                      />
                      <span className="text-xs font-medium text-slate-900 truncate">
                        {theme.name}
                      </span>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL DISPLAY CONTROLS */}
      <div className="pt-4 border-t border-slate-200 space-y-2.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-900">
          Form Display Options
        </span>
        <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer hover:bg-slate-50/50">
          <div>
            <div className="font-semibold">Show Progress Bar</div>
            <div className="text-[10px] text-slate-400">
              Styled using the active primary accent color
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.showProgressBar}
            onChange={(e) =>
              onUpdateForm({ showProgressBar: e.target.checked, updatedAt: 'Just now' })
            }
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
          />
        </label>
        <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer hover:bg-slate-50/50">
          <div>
            <div className="font-semibold">Show Step Numbers (01 / 05)</div>
            <div className="text-[10px] text-slate-400">Numbered indices beside question titles</div>
          </div>
          <input
            type="checkbox"
            checked={form.showQuestionNumbers}
            onChange={(e) =>
              onUpdateForm({ showQuestionNumbers: e.target.checked, updatedAt: 'Just now' })
            }
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
          />
        </label>
        <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer hover:bg-slate-50/50">
          <div>
            <div className="font-semibold">Keyboard Hotkeys</div>
            <div className="text-[10px] text-slate-400">
              Allow respondents to press Enter, Tab, and letter keys
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.allowKeyboardShortcuts}
            onChange={(e) =>
              onUpdateForm({
                allowKeyboardShortcuts: e.target.checked,
                updatedAt: 'Just now',
              })
            }
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
          />
        </label>
      </div>
    </div>
  );
};
