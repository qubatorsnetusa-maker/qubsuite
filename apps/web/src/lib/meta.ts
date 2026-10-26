/**
 * Helper to dynamically update the document title and Open Graph / Twitter
 * meta tags so social link previews (WhatsApp, Telegram, Slack, Twitter/X, iMessage)
 * and browser tabs reflect the exact document title and product across the suite.
 */
export interface PageMetadata {
  title?: string;
  description?: string;
  suiteName?: 'Docs' | 'Sheets' | 'Slides' | 'Forms' | 'Drive' | 'PDF';
  imageUrl?: string;
}

export function setPageMetadata(meta: PageMetadata) {
  if (typeof document === 'undefined') return;

  const baseTitle = meta.title?.trim() || 'Untitled';
  const fullTitle = meta.suiteName ? `${baseTitle} – Qub ${meta.suiteName}` : `${baseTitle} – QubSuite`;

  // 1. Update standard document title
  document.title = fullTitle;

  // 2. Helper to set or create meta tag
  const setMeta = (propertyAttr: 'property' | 'name', attrValue: string, content: string) => {
    let el = document.querySelector(`meta[${propertyAttr}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(propertyAttr, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // 3. Open Graph meta tags (used by WhatsApp, Telegram, Facebook, LinkedIn, iMessage)
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:site_name', meta.suiteName ? `Qub ${meta.suiteName}` : 'QubSuite');
  if (meta.description) {
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'description', meta.description);
  }
  if (meta.imageUrl) {
    setMeta('property', 'og:image', meta.imageUrl);
  }

  // 4. Twitter / X Card meta tags
  setMeta('name', 'twitter:title', fullTitle);
  if (meta.description) {
    setMeta('name', 'twitter:description', meta.description);
  }
  if (meta.imageUrl) {
    setMeta('name', 'twitter:image', meta.imageUrl);
  }
}
