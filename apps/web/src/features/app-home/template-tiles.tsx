import type { Template } from '@qub/shared/templates';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import type { AppConfig } from './app-config';
import { TemplateThumbnail } from './thumbnails';

const tileFrame = 'overflow-hidden rounded-md border border-border bg-white transition-[border-color,box-shadow] group-hover:border-primary group-focus-visible:border-primary group-hover:shadow-card';

/** Opens the app's `/new` route, which creates the file (from the template, if any) and replaces itself with the editor. */
function CreateLink({ app, templateId, folderId, children, label }: { app: AppConfig; templateId?: string; folderId?: string; children: React.ReactNode; label: string }) {
  return (
    <Link to={app.create} search={{ folder: folderId, template: templateId }} preload={false} className="group block rounded-md outline-none" aria-label={label}>
      {children}
    </Link>
  );
}

export function BlankTile({ app, folderId }: { app: AppConfig; folderId?: string }) {
  return (
    <CreateLink app={app} folderId={folderId} label={`Blank ${app.noun}`}>
      <div className={`${tileFrame} flex ${app.tileAspect} items-center justify-center`}>
        <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 transition-colors group-hover:bg-primary-soft">
          <Plus className="size-9" style={{ color: app.color }} strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-medium">Blank {app.noun}</p>
      <p className="truncate text-xs text-muted">Start from scratch</p>
    </CreateLink>
  );
}

export function TemplateTile({ app, template, folderId }: { app: AppConfig; template: Template; folderId?: string }) {
  return (
    <CreateLink app={app} templateId={template.id} folderId={folderId} label={`${template.name} template, ${template.subtitle}`}>
      <div className={tileFrame}>
        <TemplateThumbnail template={template} className={`w-full ${app.tileAspect}`} />
      </div>
      <p className="mt-2 truncate text-sm font-medium">{template.name}</p>
      <p className="truncate text-xs text-muted">{template.subtitle}</p>
    </CreateLink>
  );
}
