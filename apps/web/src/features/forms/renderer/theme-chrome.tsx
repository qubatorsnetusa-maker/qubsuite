import type { FormThemeDto, ThemeBackgroundBlur } from '@qub/shared';
import { isHttpUrl, THEME_HEADER_BANNER_HEIGHT, THEME_LOGO_HEIGHT } from '@qub/shared';

/**
 * Display-time guard. The schema already rejects a non-http URL, but a value could reach a renderer from an
 * older client or a hand-written API call, and it must never become a `javascript:` or `data:` URL here.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  const s = url?.trim();
  return s && isHttpUrl(s) ? s : null;
}

/** The same guard for an author-supplied link, where a `javascript:` URL would be executable. */
export const safeLinkUrl = safeImageUrl;

/** `none` emits no filter at all, so an unblurred background keeps its own compositing. */
const BLUR_PX: Record<ThemeBackgroundBlur, string> = { none: '', sm: '4px', md: '10px', lg: '20px' };

/** The gradient or image layer behind the form. Fixed, so it stays put while a long classic form scrolls. */
export function FormBackground({ theme }: { theme: FormThemeDto }) {
  const bg = theme.extras?.background;
  if (!bg || bg.kind === 'color') return null;

  if (bg.kind === 'gradient') {
    // A gradient with a missing stop would render `linear-gradient(160deg, undefined, …)` — show nothing instead.
    if (!bg.from || !bg.to) return null;
    return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: `linear-gradient(${bg.angle ?? 160}deg, ${bg.from}, ${bg.to})` }} />;
  }

  const url = safeImageUrl(bg.imageUrl);
  if (!url) return null;
  const dim = bg.dim ?? 0;
  const blur = BLUR_PX[bg.blur ?? 'none'];
  return (
    <>
      <div
        aria-hidden
        data-testid="form-bg-image"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: `url(${url})`,
          // Scaled up so the blur's soft edge does not reveal the page behind it.
          ...(blur ? { filter: `blur(${blur})`, transform: 'scale(1.06)' } : {}),
        }}
      />
      {dim > 0 && <div aria-hidden data-testid="form-bg-dim" className="pointer-events-none fixed inset-0 -z-10" style={{ background: `rgba(0, 0, 0, ${dim / 100})` }} />}
    </>
  );
}

const ROW_ALIGN = { left: 'flex-row', center: 'flex-col items-center text-center', right: 'flex-row-reverse' } as const;

/** Per header style: the gap under the banner, the row's padding, and the brand name's size. */
const STYLE_CHROME = {
  minimal: { stack: 'space-y-3', row: '', name: 'text-sm', tagline: 'text-xs' },
  prominent: { stack: 'space-y-4', row: 'border-b border-border pb-4', name: 'text-lg', tagline: 'text-sm' },
  banner: { stack: '', row: '', name: 'text-lg', tagline: 'text-sm' },
} as const;

/**
 * The author's branding above the form: an optional banner strip, then the logo, brand name and
 * tagline, with a link back to their own site. The logo is decorative — the brand name beside it,
 * or the form title, carries the name.
 *
 * `headerStyle` sets how much room it takes: `minimal` is a compact row, `prominent` the same row
 * with larger type and a rule under it, and `banner` lays the brand over the header image (or a
 * block of the primary colour), which is always centred.
 */
export function FormBrandHeader({ theme }: { theme: FormThemeDto }) {
  const x = theme.extras ?? {};
  const logoUrl = x.showLogo === false ? null : safeImageUrl(x.logoUrl);
  const brandName = x.showBrandName === false ? '' : (x.brandName ?? '').trim();
  const tagline = brandName ? (x.brandTagline ?? '').trim() : '';
  const bannerUrl = safeImageUrl(x.headerBannerUrl);
  const websiteUrl = safeLinkUrl(x.websiteUrl);
  if (!logoUrl && !brandName && !bannerUrl && !websiteUrl) return null;

  const headerStyle = x.headerStyle ?? 'minimal';
  const chrome = STYLE_CHROME[headerStyle];
  // A banner is a backdrop the brand sits on, so it is centred whatever the logo alignment says.
  const align = headerStyle === 'banner' ? 'center' : (x.logoAlign ?? 'left');
  const bannerHeight = x.headerBannerHeight ?? THEME_HEADER_BANNER_HEIGHT.default;
  const onBanner = headerStyle === 'banner';

  const logo = logoUrl && (
    <img
      src={logoUrl}
      alt=""
      role="presentation"
      className="max-w-[240px] object-contain"
      style={{ height: `${x.logoHeight ?? THEME_LOGO_HEIGHT.default}px` }}
    />
  );

  const name = brandName && (
    <div className="min-w-0">
      <p className={`truncate font-semibold ${chrome.name}`} style={onBanner ? undefined : { color: 'var(--form-question)' }}>
        {brandName}
      </p>
      {tagline && <p className={`truncate ${chrome.tagline} ${onBanner ? 'text-white/80' : 'text-muted'}`}>{tagline}</p>}
    </div>
  );

  const website = websiteUrl && (
    <a
      href={websiteUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={`text-xs underline-offset-2 hover:underline ${onBanner ? 'text-white/80' : 'text-muted'} ${align === 'left' ? 'ml-auto' : align === 'right' ? 'mr-auto' : ''}`}
    >
      {(x.websiteLabel ?? '').trim() || 'Visit website'}
    </a>
  );

  // The banner style is one panel: the image (or primary colour) with the brand laid over it.
  if (onBanner) {
    return (
      <div
        data-testid="form-brand-header"
        data-header-style="banner"
        className="relative w-full overflow-hidden rounded-lg"
        style={{ background: theme.primaryColor, minHeight: bannerUrl ? `${bannerHeight}px` : undefined }}
      >
        {bannerUrl && (
          <>
            <img src={bannerUrl} alt="" role="presentation" data-testid="form-header-banner" className="absolute inset-0 size-full object-cover" />
            <div aria-hidden data-testid="form-header-banner-scrim" className="absolute inset-0 bg-black/45" />
          </>
        )}
        {(logo || name || website) && (
          <div
            data-testid="form-brand-row"
            className="relative flex w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-white"
            style={{ minHeight: bannerUrl ? `${bannerHeight}px` : undefined }}
          >
            {logo}
            {name}
            {website}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="form-brand-header" data-header-style={headerStyle} className={`w-full ${chrome.stack}`}>
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt=""
          role="presentation"
          data-testid="form-header-banner"
          className="w-full rounded-lg object-cover"
          style={{ height: `${bannerHeight}px` }}
        />
      )}
      {(logo || name || website) && (
        <div data-testid="form-brand-row" className={`flex w-full flex-wrap items-center gap-3 ${ROW_ALIGN[align]} ${chrome.row}`}>
          {logo}
          {name}
          {website}
        </div>
      )}
    </div>
  );
}

export function FormFooter({ theme }: { theme: FormThemeDto }) {
  const text = theme.extras?.footerText?.trim();
  const powered = theme.extras?.showPoweredBy === true;
  if (!text && !powered) return null;
  return (
    <footer className="mx-auto flex w-full max-w-2xl flex-col items-center gap-1 px-4 py-6 text-center text-xs text-muted">
      {text && <p className="whitespace-pre-wrap">{text}</p>}
      {powered && (
        <a href="/" rel="noreferrer" className="underline-offset-2 hover:underline">
          Powered by Qub
        </a>
      )}
    </footer>
  );
}
