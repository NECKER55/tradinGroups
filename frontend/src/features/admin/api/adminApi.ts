import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';

export interface AdminUserItem {
  id_persona: number;
  username: string;
  email: string | null;
  photo_url: string | null;
  is_superuser: boolean;
  is_banned: boolean;
  is_deleted: boolean;
}

export interface AdminUsersResponse {
  total: number;
  returned: number;
  users: AdminUserItem[];
}

export interface AdminGroupItem {
  id_gruppo: number;
  nome: string;
  privacy: 'Public' | 'Private';
  descrizione: string | null;
  photo_url: string | null;
  budget_iniziale: string;
  members_count: number;
}

export interface AdminGroupsResponse {
  total: number;
  returned: number;
  groups: AdminGroupItem[];
}

function buildQuery(q: string, includeAll: boolean): string {
  const params = new URLSearchParams();
  if (q.trim()) {
    params.set('q', q.trim());
  }
  if (includeAll) {
    params.set('include_all', 'true');
  }
  return params.toString();
}

export async function getAdminUsers(q: string, includeAll: boolean): Promise<AdminUsersResponse> {
  const query = buildQuery(q, includeAll);
  const path = query ? `${ROUTES.AUTH.ADMIN_USERS}?${query}` : ROUTES.AUTH.ADMIN_USERS;
  return apiRequest<AdminUsersResponse>(path, { method: 'GET' });
}

export async function getAdminGroups(q: string, includeAll: boolean): Promise<AdminGroupsResponse> {
  const query = buildQuery(q, includeAll);
  const path = query ? `${ROUTES.AUTH.ADMIN_GROUPS}?${query}` : ROUTES.AUTH.ADMIN_GROUPS;
  return apiRequest<AdminGroupsResponse>(path, { method: 'GET' });
}

export async function setUserBanState(userId: number, isBanned: boolean): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.AUTH.ADMIN_USER_BAN(userId), {
    method: 'PATCH',
    body: JSON.stringify({ is_banned: isBanned }),
  });
}
