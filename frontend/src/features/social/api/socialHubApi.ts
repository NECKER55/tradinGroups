import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';

export interface FriendshipRow {
  id_persona: number;
  username: string;
  photo_url: string | null;
  status: 'Pending' | 'Accepted';
  direction: 'incoming' | 'outgoing' | 'friend';
  blocked_by_me: boolean;
}

export interface FriendshipsResponse {
  count: number;
  results: FriendshipRow[];
}

export interface PeopleSearchResult {
  id_persona: number;
  username: string;
  photo_url: string | null;
  is_friend: boolean;
}

export interface PeopleSearchResponse {
  q: string;
  count: number;
  results: PeopleSearchResult[];
}

export interface GroupSummary {
  id_gruppo: number;
  nome: string;
  privacy: 'Public' | 'Private';
  photo_url: string | null;
  descrizione?: string | null;
  budget_iniziale?: string;
  ruolo?: string;
  is_member?: boolean;
}

export interface CreateGroupPayload {
  nome: string;
  privacy?: 'Public' | 'Private';
  photo_url?: string;
  descrizione?: string;
  budget_iniziale?: string;
}

export interface CreateGroupResponse {
  message: string;
  group: {
    id_gruppo: number;
    nome: string;
    privacy: 'Public' | 'Private';
    photo_url: string | null;
    descrizione: string | null;
    budget_iniziale: string;
  };
}

export interface GroupSearchResponse {
  q: string;
  count: number;
  results: GroupSummary[];
}

export interface MyGroupsResponse {
  count: number;
  groups: Array<GroupSummary & { ruolo: string }>;
}

export interface GroupInviteItem {
  id_gruppo: number;
  data_invito: string;
  gruppo: GroupSummary;
  mittente: {
    id_persona: number;
    username: string;
    photo_url: string | null;
  };
}

export interface PendingGroupInvitesResponse {
  count: number;
  invites: GroupInviteItem[];
}

export interface SentGroupInviteItem {
  id_gruppo: number;
  data_invito: string;
  gruppo: GroupSummary;
  invitato: {
    id_persona: number;
    username: string;
    photo_url: string | null;
  };
}

export interface SentGroupInvitesResponse {
  count: number;
  invites: SentGroupInviteItem[];
}

export async function getMyFriendships(): Promise<FriendshipsResponse> {
  return apiRequest<FriendshipsResponse>(ROUTES.TRADING.FRIENDSHIPS, { method: 'GET' });
}

export async function searchPeople(q: string, limit = 25): Promise<PeopleSearchResponse> {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return apiRequest<PeopleSearchResponse>(`${ROUTES.TRADING.USERS_SEARCH}?${query.toString()}`, { method: 'GET' });
}

export async function sendFriendRequest(idPersona: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.TRADING.FRIENDSHIP_REQUESTS, {
    method: 'POST',
    body: JSON.stringify({ id_persona: idPersona }),
  });
}

export async function acceptFriendRequest(idPersona: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.TRADING.FRIENDSHIP_ACCEPT(idPersona), { method: 'POST' });
}

export async function rejectFriendRequest(idPersona: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.TRADING.FRIENDSHIP_REJECT(idPersona), { method: 'POST' });
}

export async function blockFriendUser(idPersona: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.TRADING.FRIENDSHIP_BLOCK(idPersona), { method: 'POST' });
}

export async function getMyGroups(): Promise<MyGroupsResponse> {
  return apiRequest<MyGroupsResponse>(ROUTES.GROUPS.MINE, { method: 'GET' });
}

export async function searchGroups(q: string, limit = 25): Promise<GroupSearchResponse> {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return apiRequest<GroupSearchResponse>(`${ROUTES.GROUPS.SEARCH}?${query.toString()}`, { method: 'GET' });
}

export async function getMyPendingGroupInvites(): Promise<PendingGroupInvitesResponse> {
  return apiRequest<PendingGroupInvitesResponse>(ROUTES.GROUPS.INVITES_PENDING, { method: 'GET' });
}

export async function getMySentGroupInvites(): Promise<SentGroupInvitesResponse> {
  return apiRequest<SentGroupInvitesResponse>(ROUTES.GROUPS.INVITES_SENT, { method: 'GET' });
}

export async function acceptGroupInvite(idGruppo: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.GROUPS.INVITE_ACCEPT(idGruppo), { method: 'POST' });
}

export async function rejectGroupInvite(idGruppo: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.GROUPS.INVITE_REJECT(idGruppo), { method: 'POST' });
}

export async function createGroup(payload: CreateGroupPayload): Promise<CreateGroupResponse> {
  return apiRequest<CreateGroupResponse>(ROUTES.GROUPS.CREATE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function invitePersonToGroup(idGruppo: number, idPersona: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.GROUPS.INVITE_TO_GROUP(idGruppo), {
    method: 'POST',
    body: JSON.stringify({ id_persona: idPersona }),
  });
}
