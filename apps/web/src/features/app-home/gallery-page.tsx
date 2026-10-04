import type { NativeFileType } from '@qub/shared';
import { TEMPLATE_CATEGORIES, templatesFor } from '@qub/shared/templates';
import type { Template } from '@qub/shared/templates';
import { useEffect } from 'react';
import { APPS, type AppConfig } from './app-config';
import { AppHeader } from './app-header';
import { BlankTile, TemplateTile } from './template-tiles';

/** Every template for one app, grouped by category. Picking one creates a file from it. */
export function TemplateGalleryPage({ type, folderId, app: override, featured }: { type: NativeFileType; folderId?: string; app?: AppConfig; featured?: { title: string; filter(t: Template): boolean } }) {
  const app = override ?? APPS[type];
  const templates = templatesFor(type);
  useEffect(() => {
    document.title = `Template gallery – Qub ${app.product}`;
  }, [app.product]);
  const featuredTemplates = featured ? (templates as Template[]).filter(featured.filter) : [];
  return (
    <div className="flex h-full flex-col bg-background">
      <AppHeader app={app} back title={<h1 className="text-[22px] text-foreground">Template gallery</h1>} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] space-y-10 px-4 py-6 sm:px-8">
          <section aria-labelledby="gallery-blank">
            <h2 id="gallery-blank" className="mb-3 text-base font-medium">
              Start fresh
            </h2>
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              <li>
                <BlankTile app={app} folderId={folderId} />
              </li>
            </ul>
          </section>
          {featured && featuredTemplates.length > 0 && (
            <section aria-labelledby="gallery-featured">
              <h2 id="gallery-featured" className="mb-3 text-base font-medium">
                {featured.title}
              </h2>
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {featuredTemplates.map((t) => (
                  <li key={t.id}>
                    <TemplateTile app={app} template={t} folderId={folderId} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {TEMPLATE_CATEGORIES[type].map((category) => {
            const inCategory = templates.filter((t) => t.category === category);
            if (!inCategory.length) return null;
            const id = `gallery-${category.replace(/\W+/g, '-').toLowerCase()}`;
            return (
              <section key={category} aria-labelledby={id}>
                <h2 id={id} className="mb-3 text-base font-medium">
                  {category}
                </h2>
                <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {inCategory.map((t) => (
                    <li key={t.id}>
                      <TemplateTile app={app} template={t} folderId={folderId} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
