import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';

export interface GroupProfile {
  id_gruppo: number;
  nome: string;
  photo_url: string | null;
  privacy: 'Public' | 'Private';
  descrizione: string | null;
  budget_iniziale: string;
}

export interface GroupProfileResponse {
  group: GroupProfile;
}

export interface GroupRankingItem {
  posizione: number;
  id_persona: number;
  username: string;
  photo_url: string | null;
  ruolo: 'Owner' | 'Admin' | 'User' | 'Guest' | 'Spectator';
  valore_totale: string;
}

export interface GroupRankingResponse {
  group: GroupProfile;
  snapshot_date: string | null;
  count: number;
  ranking: GroupRankingItem[];
}

export interface GroupMember {
  id_persona: number;
  username: string;
  photo_url: string | null;
  ruolo: 'Owner' | 'Admin' | 'User' | 'Guest' | 'Spectator';
  budget_iniziale: string;
  id_portafoglio: number | null;
  portfolio_liquidita: string | null;
}

export interface GroupMembersResponse {
  group: GroupProfile;
  count: number;
  members: GroupMember[];
}

export interface GroupWorkspaceHolding {
  id_stock: string;
  nome_societa: string;
  settore: string;
  numero: string;
  prezzo_medio_acquisto: string;
}

export interface GroupWorkspaceHistoryPoint {
  data: string;
  valore_totale: string;
}

export interface GroupWorkspaceTransaction {
  id_transazione: number;
  id_portafoglio: number;
  id_stock: string;
  tipo: 'Buy' | 'Sell';
  stato: 'Pending' | 'Executed' | 'Failed';
  prezzo_esecuzione: string;
  importo_investito: string | null;
  quantita_azioni: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface GroupWorkspaceWatchlistItem {
  id_stock: string;
  nome_societa: string;
  settore: string;
}

export interface GroupWorkspaceResponse {
  group: GroupProfile & {
    ruolo: 'Owner' | 'Admin' | 'User' | 'Guest' | 'Spectator';
  };
  portfolio: {
    id_portafoglio: number;
    liquidita: string;
    id_persona: number;
    id_gruppo: number | null;
  };
  holdings: GroupWorkspaceHolding[];
  history: GroupWorkspaceHistoryPoint[];
  transactions: GroupWorkspaceTransaction[];
  watchlist: GroupWorkspaceWatchlistItem[];
}

export interface UpdateGroupBudgetPayload {
  id_persona: number;
  delta_budget: string;
}

export interface UpdateGroupBudgetResponse {
  message: string;
  portfolio: {
    id_portafoglio: number;
    liquidita: string;
  } | null;
}

export interface GroupActionMessageResponse {
  message: string;
}

export interface LeaveGroupPayload {
  new_owner_id?: number;
}

export interface UpdateGroupProfilePayload {
  nome?: string;
  descrizione?: string | null;
}

export async function getGroupProfile(groupId: number): Promise<GroupProfileResponse> {
  return apiRequest<GroupProfileResponse>(ROUTES.GROUPS.PROFILE(groupId), { method: 'GET' });
}

export async function getGroupRanking(groupId: number): Promise<GroupRankingResponse> {
  return apiRequest<GroupRankingResponse>(ROUTES.GROUPS.RANKING(groupId), { method: 'GET' });
}

export async function getGroupWorkspace(groupId: number): Promise<GroupWorkspaceResponse> {
  return apiRequest<GroupWorkspaceResponse>(ROUTES.GROUPS.WORKSPACE(groupId), { method: 'GET' });
}

export async function getGroupMembers(groupId: number): Promise<GroupMembersResponse> {
  return apiRequest<GroupMembersResponse>(ROUTES.GROUPS.MEMBERS(groupId), { method: 'GET' });
}

export async function updateGroupMemberBudget(
  groupId: number,
  payload: UpdateGroupBudgetPayload,
): Promise<UpdateGroupBudgetResponse> {
  return apiRequest<UpdateGroupBudgetResponse>(ROUTES.GROUPS.UPDATE_MEMBER_BUDGET(groupId), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function invitePersonToGroup(groupId: number, idPersona: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.INVITE_TO_GROUP(groupId), {
    method: 'POST',
    body: JSON.stringify({ id_persona: idPersona }),
  });
}

export async function cancelGroupInvite(groupId: number, idPersona: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.CANCEL_INVITE(groupId, idPersona), {
    method: 'DELETE',
  });
}

export async function removeGroupMember(groupId: number, idPersona: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.MEMBER_BY_ID(groupId, idPersona), {
    method: 'DELETE',
  });
}

export async function promoteGroupMember(groupId: number, idPersona: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.PROMOTE_MEMBER(groupId, idPersona), {
    method: 'POST',
  });
}

export async function demoteGroupMember(groupId: number, idPersona: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.DEMOTE_MEMBER(groupId, idPersona), {
    method: 'POST',
  });
}

export async function leaveGroup(groupId: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.LEAVE(groupId), {
    method: 'POST',
  });
}

export async function leaveGroupWithPayload(groupId: number, payload: LeaveGroupPayload): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.LEAVE(groupId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateGroupName(groupId: number, nome: string): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.UPDATE_NAME(groupId), {
    method: 'PATCH',
    body: JSON.stringify({ nome }),
  });
}

export async function updateGroupDescription(groupId: number, descrizione: string | null): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.UPDATE_DESCRIPTION(groupId), {
    method: 'PATCH',
    body: JSON.stringify({ descrizione }),
  });
}

export async function updateGroupPhoto(groupId: number, file: File): Promise<GroupActionMessageResponse> {
  const formData = new FormData();
  formData.append('photo', file);

  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.UPDATE_PHOTO(groupId), {
    method: 'PATCH',
    body: formData,
  });
}

export async function removeGroupPhoto(groupId: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.UPDATE_PHOTO(groupId), {
    method: 'DELETE',
  });
}

export async function deleteGroup(groupId: number): Promise<GroupActionMessageResponse> {
  return apiRequest<GroupActionMessageResponse>(ROUTES.GROUPS.BY_ID(groupId), {
    method: 'DELETE',
  });
}
