import type { Editor } from '@tiptap/react';
import { useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { docsService } from '@/services/docs';

/** Helper to upload image file with instant local blob preview and background server sync */
export async function handleImageFile(file: File, editor: Editor, documentId: string) {
  if (!file.type.startsWith('image/')) return;
  
  // 1. Instantly display preview on editor canvas
  const localPreviewUrl = URL.createObjectURL(file);
  editor.chain().focus().setImage({ src: localPreviewUrl, alt: file.name }).run();

  try {
    // 2. Upload in background
    const { url } = await docsService.uploadImage(documentId, file);
    // Find image node and replace localPreviewUrl with uploaded persistent URL
    const { state, dispatch } = editor.view;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === localPreviewUrl) {
        dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url }));
      }
    });
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

/** Image upload shared by toolbar button, Insert Image, and drag-and-drop */
export function useImageUpload(editor: Editor, documentId: string): { pick(): void; input: ReactNode } {
  const ref = useRef<HTMLInputElement>(null);

  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void handleImageFile(f, editor, documentId);
        e.target.value = '';
      }}
    />
  );
  return { pick: () => ref.current?.click(), input };
}
