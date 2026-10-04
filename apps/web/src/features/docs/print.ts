import type { Editor } from '@tiptap/core';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { printHtml } from '@/lib/print-frame';
import { documentFile } from './download';

let printing = false;

/**
 * Prints the document and nothing else: the same standalone page as "Download → Web page" (images embedded),
 * printed from a hidden frame so the app's menus, toolbar and panels never reach the printer.
 */
export async function printDocument(editor: Editor, title: string): Promise<void> {
  if (printing) return;
  printing = true;
  const loading = toast.loading('Preparing to print…');
  try {
    const file = await documentFile(editor, title, 'html');
    toast.dismiss(loading);
    if (file.failedImages) toast.warning(file.failedImages === 1 ? '1 image couldn’t be loaded for printing.' : `${file.failedImages} images couldn’t be loaded for printing.`);
    await printHtml(typeof file.content === 'string' ? file.content : new TextDecoder().decode(file.content));
  } catch (e) {
    toast.dismiss(loading);
    toast.error(errorMessage(e));
  } finally {
    printing = false;
  }
}
