import { queryOptions } from '@tanstack/react-query'
import { getSessionFn } from './auth'
import { getUserPreferencesFn } from './preferences'
import {
  getFormConfigFn,
  getPublicFormConfigFn,
  listWorkspaceFormsFn,
  listWorkspaceSubmissionsFn,
  listWorkspacesFn,
} from './workspaces'

// Route loaders read through these via queryClient.fetchQuery. Pages seed
// local state from loader data and mutate it directly, so staleTime is 0:
// every navigation refetches, exactly like the original loaders did.

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: getSessionFn,
  staleTime: 0,
})

export const preferencesQuery = queryOptions({
  queryKey: ['preferences'],
  queryFn: getUserPreferencesFn,
  staleTime: 0,
})

export const workspacesQuery = queryOptions({
  queryKey: ['workspaces'],
  queryFn: listWorkspacesFn,
  staleTime: 0,
})

export const workspaceFormsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'forms'],
    queryFn: () => listWorkspaceFormsFn({ data: { workspaceId } }),
    staleTime: 0,
  })

export const workspaceSubmissionsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'submissions'],
    queryFn: () => listWorkspaceSubmissionsFn({ data: { workspaceId } }),
    staleTime: 0,
  })

export const formQuery = (formId: string) =>
  queryOptions({
    queryKey: ['forms', formId],
    queryFn: () => getFormConfigFn({ data: { formId } }),
    staleTime: 0,
  })

export const publicFormQuery = (formId: string) =>
  queryOptions({
    queryKey: ['public-forms', formId],
    queryFn: () => getPublicFormConfigFn({ data: { formId } }),
    staleTime: 0,
  })
