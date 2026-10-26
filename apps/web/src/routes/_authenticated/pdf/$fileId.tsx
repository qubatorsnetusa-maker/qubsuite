import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { driveService } from '@/services/drive';
import { PdfStudio } from '@/features/pdf/pdf-studio';
import { FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PdfFileRouteComponent() {
  const params = useParams({ strict: false }) as { fileId?: string };
  const fileId = params.fileId;
  const navigate = useNavigate();

  const { data: file, isLoading, error } = useQuery({
    queryKey: ['drive', 'file', fileId],
    queryFn: () => driveService.file(fileId!),
    enabled: !!fileId,
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="size-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
          <span className="text-sm font-medium">Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center space-y-4">
        <FileText className="size-12 text-red-500 opacity-60" />
        <h2 className="text-xl font-bold">Document Not Found</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          The requested PDF file could not be found or you may not have permission to view it.
        </p>
        <Button onClick={() => void navigate({ to: '/pdf' as any })}>
          Back to PDF Studio
        </Button>
      </div>
    );
  }

  const pdfUrl = driveService.contentUrl(file.id);

  return (
    <PdfStudio
      pdfUrl={pdfUrl}
      fileName={file.name}
      onBack={() => void navigate({ to: '/pdf' as any })}
      onSaveToDrive={(blob, fileName) => {
        const uploadedFile = new File([blob], fileName, { type: 'application/pdf' });
        void driveService.upload(uploadedFile, file.folderId ?? undefined);
      }}
    />
  );
}

export const Route = createFileRoute('/_authenticated/pdf/$fileId')({
  component: PdfFileRouteComponent,
});
