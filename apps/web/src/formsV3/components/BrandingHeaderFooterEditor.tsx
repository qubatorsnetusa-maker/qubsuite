import React from 'react';
import {
  Sparkles,
  LayoutTemplate,
  ShieldCheck,
  ExternalLink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Image as ImageIcon,
  Building,
  Mail,
  Lock,
  Globe,
  FileText,
  ChevronRight,
} from 'lucide-react';
import type { FormConfig, FormHeaderConfig, FormFooterConfig } from '../types';

interface BrandingHeaderFooterEditorProps {
  form: FormConfig;
  onUpdateForm: (updated: Partial<FormConfig>) => void;
}

// Preset modern brand logos for 1-click testing
const PRESET_LOGOS = [
  {
    name: 'Minimal Mark',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&h=120&q=80',
  },
  {
    name: 'Geometric Hex',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=120&h=120&q=80',
  },
  {
    name: 'Abstract Circle',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=120&h=120&q=80',
  },
];

export const BrandingHeaderFooterEditor: React.FC<BrandingHeaderFooterEditorProps> = ({
  form,
  onUpdateForm,
}) => {
  const header: FormHeaderConfig = form.header || {
    showLogo: true,
    logoUrl: '',
    logoHeight: 32,
    logoAlignment: 'left',
    brandName: '',
    showBrandName: true,
    brandTagline: '',
    websiteUrl: '',
    websiteLabel: 'Visit website',
    headerStyle: 'minimal',
    showHeaderBanner: false,
    headerBannerUrl: '',
    headerBannerHeight: 120,
  };

  const footer: FormFooterConfig = form.footer || {
    enabled: true,
    copyrightText: '© ' + new Date().getFullYear() + ' ' + (header.brandName || form.title || 'Company Inc.'),
    showPoweredBy: true,
    privacyPolicyUrl: '#privacy',
    privacyPolicyLabel: 'Privacy Policy',
    termsUrl: '#terms',
    termsLabel: 'Terms of Service',
    supportEmail: '',
    supportLabel: 'Need Help?',
    securityBadge: true,
    alignment: 'between',
  };

  const handleUpdateHeader = (updates: Partial<FormHeaderConfig>) => {
    onUpdateForm({
      header: {
        ...header,
        ...updates,
      },
      updatedAt: 'Just now',
    });
  };

  const handleUpdateFooter = (updates: Partial<FormFooterConfig>) => {
    onUpdateForm({
      footer: {
        ...footer,
        ...updates,
      },
      updatedAt: 'Just now',
    });
  };

  return (
    <div className="space-y-6 pb-6 text-slate-800">
      {/* SECTION 1: BRANDING & HEADER */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-900" />
            <h3 className="font-headline-sm text-xs font-bold uppercase tracking-wider text-slate-900">
              Branding & Header
            </h3>
          </div>
          <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            Top Navigation
          </span>
        </div>

        <div className="space-y-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
          {/* Brand Name & Tagline */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Brand / Organization Name
              </label>
              <input
                type="text"
                value={header.brandName || ''}
                onChange={(e) => handleUpdateHeader({ brandName: e.target.value })}
                placeholder="e.g. Acme Corporation, Stripe, Notion"
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Brand Tagline or Division (Optional)
              </label>
              <input
                type="text"
                value={header.brandTagline || ''}
                onChange={(e) => handleUpdateHeader({ brandTagline: e.target.value })}
                placeholder="e.g. Customer Experience, Research & Design"
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Logo Settings */}
          <div className="pt-3 border-t border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                Brand Logo
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={header.showLogo ?? true}
                  onChange={(e) => handleUpdateHeader({ showLogo: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-600"
                />
                <span>Display</span>
              </label>
            </div>

            {header.showLogo !== false && (
              <>
                <div>
                  <input
                    type="text"
                    value={header.logoUrl || ''}
                    onChange={(e) => handleUpdateHeader({ logoUrl: e.target.value })}
                    placeholder="https://... logo image URL (PNG, SVG, JPG)"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">Sample logos:</span>
                    {PRESET_LOGOS.map((sample) => (
                      <button
                        key={sample.name}
                        type="button"
                        onClick={() => handleUpdateHeader({ logoUrl: sample.url })}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        {sample.name}
                      </button>
                    ))}
                    {header.logoUrl && (
                      <button
                        type="button"
                        onClick={() => handleUpdateHeader({ logoUrl: '' })}
                        className="text-[10px] text-rose-500 hover:underline ml-auto cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Logo Height and Alignment */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>Logo Height</span>
                      <span className="font-mono-code text-[10px]">{header.logoHeight || 32}px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="60"
                      step="2"
                      value={header.logoHeight || 32}
                      onChange={(e) =>
                        handleUpdateHeader({ logoHeight: parseInt(e.target.value, 10) })
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Alignment
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'left', icon: AlignLeft },
                          { id: 'center', icon: AlignCenter },
                          { id: 'right', icon: AlignRight },
                        ] as const
                      ).map(({ id, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleUpdateHeader({ logoAlignment: id })}
                          className={`p-1 rounded-md border flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 ${
                            (header.logoAlignment || 'left') === id
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Website Link in Header */}
          <div className="pt-3 border-t border-slate-200/70 space-y-2">
            <label className="block text-[11px] font-semibold text-slate-700">
              External Website / Return Link
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={header.websiteUrl || ''}
                onChange={(e) => handleUpdateHeader({ websiteUrl: e.target.value })}
                placeholder="https://yourcompany.com"
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
              />
              <input
                type="text"
                value={header.websiteLabel || ''}
                onChange={(e) => handleUpdateHeader({ websiteLabel: e.target.value })}
                placeholder="Link text (e.g. Back to Site)"
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
              />
            </div>
          </div>

          {/* Header Banner Option */}
          <div className="pt-3 border-t border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Header Cover Banner
                </span>
                <span className="text-[10px] text-slate-500">
                  Adds an image banner strip across the very top
                </span>
              </div>
              <input
                type="checkbox"
                checked={header.showHeaderBanner ?? false}
                onChange={(e) => handleUpdateHeader({ showHeaderBanner: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
              />
            </div>

            {header.showHeaderBanner && (
              <div className="space-y-2 pt-2">
                <input
                  type="text"
                  value={header.headerBannerUrl || ''}
                  onChange={(e) => handleUpdateHeader({ headerBannerUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/... banner image URL"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                />
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>Banner Height</span>
                  <span className="font-mono-code text-[10px]">
                    {header.headerBannerHeight || 120}px
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="240"
                  step="10"
                  value={header.headerBannerHeight || 120}
                  onChange={(e) =>
                    handleUpdateHeader({
                      headerBannerHeight: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: CUSTOMER FOOTER */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-slate-900" />
            <h3 className="font-headline-sm text-xs font-bold uppercase tracking-wider text-slate-900">
              Customer Footer
            </h3>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={footer.enabled}
              onChange={(e) => handleUpdateFooter({ enabled: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
            />
            <span>Enabled</span>
          </label>
        </div>

        {footer.enabled && (
          <div className="space-y-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
            {/* Copyright Text */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Copyright Notice
              </label>
              <input
                type="text"
                value={footer.copyrightText || ''}
                onChange={(e) => handleUpdateFooter({ copyrightText: e.target.value })}
                placeholder="© 2026 Acme Technologies. All rights reserved."
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-600 focus:outline-none font-medium"
              />
            </div>

            {/* Privacy & Terms Links */}
            <div className="pt-2 border-t border-slate-200/70 space-y-3">
              <span className="block text-xs font-semibold text-slate-900">
                Legal & Compliance Links
              </span>

              {/* Privacy Policy */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Privacy Policy Label
                  </label>
                  <input
                    type="text"
                    value={footer.privacyPolicyLabel || ''}
                    onChange={(e) =>
                      handleUpdateFooter({ privacyPolicyLabel: e.target.value })
                    }
                    placeholder="Privacy Policy"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Privacy URL or Modal
                  </label>
                  <input
                    type="text"
                    value={footer.privacyPolicyUrl || ''}
                    onChange={(e) =>
                      handleUpdateFooter({ privacyPolicyUrl: e.target.value })
                    }
                    placeholder="https://... or #privacy"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              {/* Terms of Service */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Terms Label
                  </label>
                  <input
                    type="text"
                    value={footer.termsLabel || ''}
                    onChange={(e) => handleUpdateFooter({ termsLabel: e.target.value })}
                    placeholder="Terms of Service"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Terms URL
                  </label>
                  <input
                    type="text"
                    value={footer.termsUrl || ''}
                    onChange={(e) => handleUpdateFooter({ termsUrl: e.target.value })}
                    placeholder="https://... or #terms"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Support / Help Email */}
            <div className="pt-2 border-t border-slate-200/70 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700">
                Customer Support Contact
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={footer.supportEmail || ''}
                  onChange={(e) => handleUpdateFooter({ supportEmail: e.target.value })}
                  placeholder="support@company.com"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                />
                <input
                  type="text"
                  value={footer.supportLabel || ''}
                  onChange={(e) => handleUpdateFooter({ supportLabel: e.target.value })}
                  placeholder="Label: Contact Support"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>
            </div>

            {/* Trust & Badges */}
            <div className="pt-2 border-t border-slate-200/70 space-y-2.5">
              <span className="block text-xs font-semibold text-slate-900">
                Badges & Attribution
              </span>

              {/* Security Badge */}
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-semibold block">SSL Encryption Badge</span>
                    <span className="text-[10px] text-slate-500">
                      256-bit encrypted & secure submission notice
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={footer.securityBadge ?? true}
                  onChange={(e) => handleUpdateFooter({ securityBadge: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
                />
              </label>

              {/* Powered By Badge */}
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="font-semibold block">Powered by qub-forms Badge</span>
                    <span className="text-[10px] text-slate-500">
                      Subtle platform credit pill at footer right
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={footer.showPoweredBy ?? true}
                  onChange={(e) => handleUpdateFooter({ showPoweredBy: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
