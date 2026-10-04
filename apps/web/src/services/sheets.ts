import type {
  CellsResult,
  CreateSheetCommentInput,
  CreateSpreadsheetInput,
  FilterQuery,
  SheetCommentDto,
  SheetOp,
  SheetPrintData,
  SheetServerMessage,
  SpreadsheetDto,
  SpreadsheetVersionDto,
  UpdateWorksheetInput,
  WorksheetDto,
} from '@qub/shared';
import { api, buildUrl, uploadFile } from '@/lib/api';

export interface CellWindow {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export const sheetsService = {
  create: (input: CreateSpreadsheetInput) => api<SpreadsheetDto>('/sheets', { method: 'POST', body: input }),
  get: (id: string) => api<SpreadsheetDto>(`/sheets/${id}`),
  rename: (id: string, title: string) => api<SpreadsheetDto>(`/sheets/${id}`, { method: 'PATCH', body: { title } }),
  trash: (id: string) => api(`/sheets/${id}/trash`, { method: 'POST' }),
  cells: (id: string, sheetId: string, w: CellWindow, signal?: AbortSignal) => api<CellsResult>(`/sheets/${id}/worksheets/${sheetId}/cells`, { query: { ...w }, signal }),
  printData: (id: string, sheetId: string) => api<SheetPrintData>(`/sheets/${id}/worksheets/${sheetId}/print`),
  applyOps: (id: string, ops: SheetOp[], clientOpId?: string) =>
    api<Extract<SheetServerMessage, { type: 'applied' }>>(`/sheets/${id}/ops`, { method: 'POST', body: { ops, clientOpId } }),
  addSheet: (id: string, name?: string) => api<WorksheetDto[]>(`/sheets/${id}/worksheets`, { method: 'POST', body: { name } }),
  updateSheet: (id: string, sheetId: string, input: UpdateWorksheetInput) => api<WorksheetDto[]>(`/sheets/${id}/worksheets/${sheetId}`, { method: 'PATCH', body: input }),
  deleteSheet: (id: string, sheetId: string) => api<WorksheetDto[]>(`/sheets/${id}/worksheets/${sheetId}`, { method: 'DELETE' }),
  filter: (id: string, sheetId: string, q: FilterQuery) => api<{ rows: number[]; lastRow: number }>(`/sheets/${id}/worksheets/${sheetId}/filter`, { query: { ...q } }),
  versions: (id: string) => api<SpreadsheetVersionDto[]>(`/sheets/${id}/versions`),
  createVersion: (id: string, name?: string) => api<SpreadsheetVersionDto[]>(`/sheets/${id}/versions`, { method: 'POST', body: { name } }),
  restoreVersion: (id: string, versionId: string) => api<SpreadsheetDto>(`/sheets/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  comments: (id: string, sheetId: string) => api<SheetCommentDto[]>(`/sheets/${id}/worksheets/${sheetId}/comments`),
  addComment: (id: string, sheetId: string, input: CreateSheetCommentInput) => api<SheetCommentDto[]>(`/sheets/${id}/worksheets/${sheetId}/comments`, { method: 'POST', body: input }),
  resolveComment: (id: string, commentId: string, resolved: boolean) => api(`/sheets/${id}/comments/${commentId}/resolve`, { method: 'POST', body: { resolved } }),
  deleteComment: (id: string, commentId: string) => api(`/sheets/${id}/comments/${commentId}`, { method: 'DELETE' }),
  find: (id: string, q: { q: string; matchCase: boolean; wholeCell: boolean; includeFormulas: boolean; sheetId?: string }) =>
    api<{ matches: { sheetId: string; row: number; col: number }[]; total: number }>(`/sheets/${id}/find`, {
      query: { q: q.q, matchCase: String(q.matchCase), wholeCell: String(q.wholeCell), includeFormulas: String(q.includeFormulas), ...(q.sheetId ? { sheetId: q.sheetId } : {}) },
    }),
  /** Same-origin URL authorised by the media cookie, usable in <a download>. */
  csvUrl: (id: string, sheetId: string) => buildUrl(`/sheets/${id}/worksheets/${sheetId}/export.csv`),
  importCsv: (id: string, file: File, mode: 'new_sheet' | 'replace_sheet', sheetId?: string) =>
    uploadFile<{ sheetId: string; rows: number; cols: number }>(`/sheets/${id}/import`, file, { query: { mode, ...(sheetId ? { sheetId } : {}) } }),
};
