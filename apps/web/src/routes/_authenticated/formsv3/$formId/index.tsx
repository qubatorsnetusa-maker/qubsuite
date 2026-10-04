import { createFileRoute } from '@tanstack/react-router';
import { FormBuilderPage } from '@/formsV3/pages/FormBuilder';
import { formQuery } from '@/formsV3/api/queries';

export const Route = createFileRoute('/_authenticated/formsv3/$formId/')({
  loader: async ({ params, context: { queryClient } }) => {
    const { form } = await queryClient.fetchQuery(formQuery(params.formId));
    return { form };
  },
  component: FormsV3BuilderComponent,
});

function FormsV3BuilderComponent() {
  const { form } = Route.useLoaderData();
  return <FormBuilderPage form={form} />;
}
