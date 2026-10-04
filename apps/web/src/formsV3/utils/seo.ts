type PageMetaOptions = {
  title: string
  description: string
  /** Set for authenticated app screens and user-generated form pages that shouldn't be indexed. */
  noindex?: boolean
}

/**
 * Per-route head() meta. Tags here are keyed by `name`/`property`, so they
 * override the site-wide defaults set in `__root.tsx` for the same key
 * (TanStack Router resolves duplicates leaf-route-first).
 */
export function pageMeta({ title, description, noindex }: PageMetaOptions) {
  return {
    meta: [
      { title: `${title} · Qub Forms` },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ],
  }
}
