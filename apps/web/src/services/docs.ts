import type {
  CollaboratorDto,
  CommentDto,
  CreateCommentInput,
  CreateDocumentInput,
  CreateSuggestionInput,
  DocumentDto,
  DocumentVersionDto,
  SuggestionDto,
  UpdateCommentInput,
} from '@qub/shared';
import { api, uploadFile } from '@/lib/api';

export const docsService = {
  create: (input: CreateDocumentInput) => api<DocumentDto>('/docs', { method: 'POST', body: input }),
  get: (id: string) => api<DocumentDto>(`/docs/${id}`),
  rename: (id: string, title: string) => api<DocumentDto>(`/docs/${id}`, { method: 'PATCH', body: { title } }),
  trash: (id: string) => api(`/docs/${id}/trash`, { method: 'POST' }),
  collaborators: (id: string) => api<CollaboratorDto[]>(`/docs/${id}/collaborators`),
  uploadImage: (id: string, file: File) => uploadFile<{ id: string; url: string }>(`/docs/${id}/images`, file),

  versions: (id: string) => api<DocumentVersionDto[]>(`/docs/${id}/versions`),
  version: (id: string, versionId: string) => api<{ id: string; versionNumber: number; name: string | null; content: unknown; createdAt: string }>(`/docs/${id}/versions/${versionId}`),
  createVersion: (id: string, name?: string) => api<DocumentVersionDto>(`/docs/${id}/versions`, { method: 'POST', body: { name } }),
  restoreVersion: (id: string, versionId: string) => api<DocumentDto>(`/docs/${id}/versions/${versionId}/restore`, { method: 'POST' }),

  comments: (id: string) => api<CommentDto[]>(`/docs/${id}/comments`),
  createComment: (id: string, input: CreateCommentInput) => api<CommentDto>(`/docs/${id}/comments`, { method: 'POST', body: input }),
  updateComment: (id: string, commentId: string, input: UpdateCommentInput) => api<CommentDto[]>(`/docs/${id}/comments/${commentId}`, { method: 'PATCH', body: input }),
  deleteComment: (id: string, commentId: string) => api(`/docs/${id}/comments/${commentId}`, { method: 'DELETE' }),
  resolveComment: (id: string, commentId: string, resolved: boolean) => api<CommentDto[]>(`/docs/${id}/comments/${commentId}/${resolved ? 'resolve' : 'reopen'}`, { method: 'POST' }),
  reply: (id: string, commentId: string, input: UpdateCommentInput) => api<CommentDto[]>(`/docs/${id}/comments/${commentId}/replies`, { method: 'POST', body: input }),
  updateReply: (id: string, commentId: string, replyId: string, input: UpdateCommentInput) =>
    api<CommentDto[]>(`/docs/${id}/comments/${commentId}/replies/${replyId}`, { method: 'PATCH', body: input }),
  deleteReply: (id: string, commentId: string, replyId: string) => api(`/docs/${id}/comments/${commentId}/replies/${replyId}`, { method: 'DELETE' }),

  suggestions: (id: string) => api<SuggestionDto[]>(`/docs/${id}/suggestions`),
  createSuggestion: (id: string, input: CreateSuggestionInput) => api<SuggestionDto[]>(`/docs/${id}/suggestions`, { method: 'POST', body: input }),
  resolveSuggestion: (id: string, suggestionId: string, accept: boolean) =>
    api<SuggestionDto[]>(`/docs/${id}/suggestions/${suggestionId}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }),
};
