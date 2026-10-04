import type { DragEvent } from 'react';

/** MIME type for Qub items dragged inside the app. External files use the browser's Files type. */
export const QUB_ITEMS = 'application/x-qub-items';

export interface DraggedItem {
  kind: 'file' | 'folder';
  id: string;
  name: string;
}

export function setDragItems(e: DragEvent, items: DraggedItem[]) {
  e.dataTransfer.setData(QUB_ITEMS, JSON.stringify(items));
  e.dataTransfer.effectAllowed = 'move';
}

export function readDragItems(e: DragEvent): DraggedItem[] | null {
  const raw = e.dataTransfer.getData(QUB_ITEMS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraggedItem[];
  } catch {
    return null;
  }
}

export const hasQubItems = (e: DragEvent) => e.dataTransfer.types.includes(QUB_ITEMS);
export const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
