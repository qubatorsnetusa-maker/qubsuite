import { FORMS_V2_APP } from '@/features/app-home/app-config';
import { TemplateGalleryPage } from '@/features/app-home/gallery-page';
import { AppHomePage } from '@/features/app-home/home-page';

/** Forms v2 home: every form (including ones made in classic Forms); new ones and opened ones go to the v2 builder. */
export function FormsV2Home({ folderId }: { folderId?: string }) {
  return <AppHomePage type="FORM" folderId={folderId} app={FORMS_V2_APP} />;
}

/** The Forms template gallery; picking a template creates a Forms v2 form from it. */
export function FormsV2Gallery({ folderId }: { folderId?: string }) {
  return <TemplateGalleryPage type="FORM" folderId={folderId} app={FORMS_V2_APP} featured={{ title: 'Conversational', filter: (t) => t.app === 'FORM' && !!t.conversational }} />;
}
