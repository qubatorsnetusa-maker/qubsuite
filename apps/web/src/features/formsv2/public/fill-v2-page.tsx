import { useParams } from '@tanstack/react-router';
import { FillForm } from '@/features/forms/fill-page';

/** Public respondent page at /formsv2/f/$formId. `$formId` is the form's public id, never its database id. */
export function FillV2Page() {
  const { formId: publicId } = useParams({ from: '/formsv2/f/$formId' });
  return <FillForm publicId={publicId} />;
}
