import type { CellRange, ParsedSheetOp, SheetOp } from './schemas';
import type { CellDto, NotificationDto, UserSummary, WorksheetDto } from './types';

export interface PresenceUser extends UserSummary {
  color: string;
  clientId: string;
}

// ---------- Sheets protocol (JSON over WebSocket) ----------

export interface SheetSelection {
  sheetId: string;
  activeRow: number;
  activeCol: number;
  range: CellRange | null;
}

export type SheetClientMessage =
  /** `clientOpId` lets the client match the server ack to its pending local op. */
  | { type: 'ops'; clientOpId: string; baseRevision: number; ops: SheetOp[] }
  | { type: 'presence'; selection: SheetSelection | null }
  | { type: 'ping' };

export type SheetServerMessage =
  | { type: 'welcome'; clientId: string; revision: number; presence: SheetPresenceState[]; self: PresenceUser }
  | {
      type: 'applied';
      revision: number;
      clientOpId: string | null;
      authorClientId: string | null;
      ops: ParsedSheetOp[];
      /** Every cell whose stored state changed, including recalculated dependents. */
      changes: { sheetId: string; cells: CellDto[]; removed: { row: number; col: number }[] }[];
      /** Sheets whose structure changed (row/col insert/delete, sort) must be refetched in the visible window. */
      structural: string[];
      sheets?: WorksheetDto[];
      /** findReplace: previous inputs of the replaced cells, so the author can undo. */
      replaced?: { sheetId: string; row: number; col: number; previousInput: string }[];
    }
  | { type: 'rejected'; clientOpId: string; code: string; message: string }
  | { type: 'presence'; presence: SheetPresenceState[] }
  | { type: 'sheets'; sheets: WorksheetDto[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

export interface SheetPresenceState {
  user: PresenceUser;
  selection: SheetSelection | null;
}

// ---------- Docs protocol ----------

/** Custom y-websocket message type (0 = sync, 1 = awareness, 3 = query awareness are reserved). */
export const DOC_MESSAGE_SAVE_STATUS = 100;

export interface DocSaveStatus {
  status: 'saved' | 'error';
  savedAt: string;
}

// ---------- Forms & notifications ----------

export type FormServerMessage =
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'response'; responseCount: number; submittedAt: string }
  | { type: 'formUpdated'; by: string; txId?: string; revision?: number }
  | { type: 'pong' };

export type FormClientMessage = { type: 'changed' } | { type: 'ping' };

export type NotificationServerMessage =
  | { type: 'notification'; notification: NotificationDto; unreadCount: number }
  | { type: 'unreadCount'; unreadCount: number }
  | { type: 'pong' };

/** Deterministic, readable colors for presence. */
export const PRESENCE_COLORS = [
  '#e8710a',
  '#1a73e8',
  '#d93025',
  '#188038',
  '#9334e6',
  '#e52592',
  '#12b5cb',
  '#b06000',
  '#3949ab',
  '#00897b',
] as const;

export function presenceColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]!;
}
