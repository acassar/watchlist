import type {
  CreateInvitationRequest,
  CreatedInvitation,
  GroupDetail,
  GroupSummary,
  Invitation,
  InvitationPreview,
  InvitationRequest,
} from '@watchlist/shared';
import { api } from '@/api/http';

const g = (groupId: string) => `/groups/${encodeURIComponent(groupId)}`;

export const groupsApi = {
  list: () => api<GroupSummary[]>('/groups'),
  create: (name: string) => api<GroupDetail>('/groups', { body: { name } }),
  detail: (groupId: string) => api<GroupDetail>(g(groupId)),
  rename: (groupId: string, name: string) =>
    api<GroupDetail>(g(groupId), { method: 'PATCH', body: { name } }),
  leave: (groupId: string) => api(`${g(groupId)}/leave`, { method: 'POST' }),
  removeMember: (groupId: string, userId: string) =>
    api(`${g(groupId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
  invitations: (groupId: string) =>
    api<Invitation[]>(`${g(groupId)}/invitations`),
  createInvitation: (groupId: string, body: CreateInvitationRequest = {}) =>
    api<CreatedInvitation>(`${g(groupId)}/invitations`, { body }),
  revokeInvitation: (groupId: string, invitationId: string) =>
    api(`${g(groupId)}/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE',
    }),
  previewInvitation: (body: InvitationRequest) =>
    api<InvitationPreview>('/invitations/preview', { body }),
  acceptInvitation: (body: InvitationRequest) =>
    api<GroupSummary>('/invitations/accept', { body }),
};
