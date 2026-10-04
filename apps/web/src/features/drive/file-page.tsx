import { useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { openPath } from '@/services/drive';
import { FileViewer } from './file-viewer';
import { ItemActionsProvider } from './item-actions';
import { useDriveFile } from './queries';

/** A file opened by link (notifications, search, shared links): the full-screen viewer as its own page. */
function Viewer() {
  const { fileId } = useParams({ from: '/_authenticated/drive/file/$fileId' });
  const file = useDriveFile(fileId);
  const navigate = useNavigate();
  const router = useRouter();

  // Qub-native files open in their own app.
  useEffect(() => {
    if (file.data && ['DOCUMENT', 'SPREADSHEET', 'FORM'].includes(file.data.fileType) && file.data.resourceId) {
      void navigate({ href: openPath({ kind: 'file', id: file.data.id, fileType: file.data.fileType, resourceId: file.data.resourceId }), replace: true });
    }
  }, [file.data, navigate]);

  if (file.isLoading) return <FullPageSpinner />;
  if (file.error) return <ErrorState error={file.error} onRetry={() => void file.refetch()} />;
  const f = file.data!;
  const close = () => {
    // Back to wherever the file was opened from, or its folder when opened directly.
    if (router.history.length > 1) router.history.back();
    else void navigate(f.folderId ? { to: '/drive/folder/$folderId', params: { folderId: f.folderId } } : { to: '/drive' });
  };
  return <FileViewer file={f} onClose={close} closeLabel="Back" />;
}

export function FilePage() {
  return (
    <ItemActionsProvider>
      <Viewer />
    </ItemActionsProvider>
  );
}
