import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getAdminGroups, getAdminUsers, setUserBanState, type AdminGroupItem, type AdminUserItem } from '../api/adminApi';

function useDebouncedValue(value: string, delayMs = 350): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function AdminDashboardPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [usersQuery, setUsersQuery] = useState('');
  const [groupsQuery, setGroupsQuery] = useState('');
  const [usersExpanded, setUsersExpanded] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmBanTarget, setConfirmBanTarget] = useState<AdminUserItem | null>(null);
  const [banActionLoading, setBanActionLoading] = useState(false);

  const debouncedUsersQuery = useDebouncedValue(usersQuery);
  const debouncedGroupsQuery = useDebouncedValue(groupsQuery);

  useEffect(() => {
    let isMounted = true;

    setLoadingUsers(true);
    void getAdminUsers(debouncedUsersQuery, usersExpanded)
      .then((response) => {
        if (!isMounted) return;
        setUsers(response.users);
        setUsersTotal(response.total);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err.message || 'Unable to load users.');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedUsersQuery, usersExpanded]);

  useEffect(() => {
    let isMounted = true;

    setLoadingGroups(true);
    void getAdminGroups(debouncedGroupsQuery, groupsExpanded)
      .then((response) => {
        if (!isMounted) return;
        setGroups(response.groups);
        setGroupsTotal(response.total);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err.message || 'Unable to load groups.');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedGroupsQuery, groupsExpanded]);

  const usersSubtitle = useMemo(() => (
    usersExpanded
      ? `Totale account: ${usersTotal} (vista completa)`
      : `Totale account: ${usersTotal} (anteprima)`
  ), [usersExpanded, usersTotal]);

  const groupsSubtitle = useMemo(() => (
    groupsExpanded
      ? `Totale gruppi: ${groupsTotal} (vista completa)`
      : `Totale gruppi: ${groupsTotal} (anteprima)`
  ), [groupsExpanded, groupsTotal]);

  async function handleConfirmBan(event: FormEvent) {
    event.preventDefault();
    if (!confirmBanTarget) return;

    setBanActionLoading(true);
    setError(null);
    try {
      await setUserBanState(confirmBanTarget.id_persona, !confirmBanTarget.is_banned);
      const refreshed = await getAdminUsers(debouncedUsersQuery, usersExpanded);
      setUsers(refreshed.users);
      setUsersTotal(refreshed.total);
      setConfirmBanTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update ban state.';
      setError(message);
    } finally {
      setBanActionLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pb-12">
      <div className="rounded-2xl border border-amber-300/35 bg-amber-500/10 p-5 text-amber-100">
        <h1 className="text-2xl font-black uppercase tracking-tight">Superuser Control Room</h1>
        <p className="mt-2 text-sm text-amber-100/80">Area amministrativa protetta: monitora account, gruppi e azioni di sicurezza.</p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-canvas/15 bg-canvas/5 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-canvas">Account Dashboard</h2>
              <p className="text-xs text-canvas/65">{usersSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setUsersExpanded((prev) => !prev)}
              className="rounded-lg border border-canvas/25 px-3 py-1.5 text-xs font-semibold text-canvas/80 transition hover:border-signal/60 hover:text-signal"
            >
              {usersExpanded ? 'Mostra meno' : 'Espandi lista'}
            </button>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-widest text-canvas/60" htmlFor="admin-users-search">Cerca account</label>
          <input
            id="admin-users-search"
            value={usersQuery}
            onChange={(event) => setUsersQuery(event.target.value)}
            placeholder="Username o email"
            className="mt-2 w-full rounded-xl border border-canvas/20 bg-black/30 px-3 py-2 text-sm text-canvas outline-none transition focus:border-signal/70"
          />

          <div className="mt-4 max-h-[28rem] overflow-auto pr-1">
            {loadingUsers ? <p className="text-sm text-canvas/60">Caricamento account...</p> : null}
            {!loadingUsers && users.length === 0 ? <p className="text-sm text-canvas/60">Nessun account trovato.</p> : null}
            {!loadingUsers && users.map((userItem) => (
              <div key={userItem.id_persona} className="mb-3 rounded-xl border border-canvas/15 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-canvas">{userItem.username}</p>
                    <p className="text-xs text-canvas/60">{userItem.email ?? 'email non disponibile'}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-canvas/55">
                      #{userItem.id_persona} {userItem.is_superuser ? '• Superuser' : ''} {userItem.is_deleted ? '• Deleted' : ''}
                    </p>
                  </div>
                  {!userItem.is_superuser && !userItem.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => setConfirmBanTarget(userItem)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        userItem.is_banned
                          ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                          : 'border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                      }`}
                    >
                      {userItem.is_banned ? 'SBAN' : 'BAN'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-canvas/15 bg-canvas/5 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-canvas">Groups Dashboard</h2>
              <p className="text-xs text-canvas/65">{groupsSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setGroupsExpanded((prev) => !prev)}
              className="rounded-lg border border-canvas/25 px-3 py-1.5 text-xs font-semibold text-canvas/80 transition hover:border-signal/60 hover:text-signal"
            >
              {groupsExpanded ? 'Mostra meno' : 'Espandi lista'}
            </button>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-widest text-canvas/60" htmlFor="admin-groups-search">Cerca gruppi</label>
          <input
            id="admin-groups-search"
            value={groupsQuery}
            onChange={(event) => setGroupsQuery(event.target.value)}
            placeholder="Nome o descrizione gruppo"
            className="mt-2 w-full rounded-xl border border-canvas/20 bg-black/30 px-3 py-2 text-sm text-canvas outline-none transition focus:border-signal/70"
          />

          <div className="mt-4 max-h-[28rem] overflow-auto pr-1">
            {loadingGroups ? <p className="text-sm text-canvas/60">Caricamento gruppi...</p> : null}
            {!loadingGroups && groups.length === 0 ? <p className="text-sm text-canvas/60">Nessun gruppo trovato.</p> : null}
            {!loadingGroups && groups.map((groupItem) => (
              <div key={groupItem.id_gruppo} className="mb-3 rounded-xl border border-canvas/15 bg-black/25 p-3">
                <p className="text-sm font-semibold text-canvas">{groupItem.nome}</p>
                <p className="mt-1 text-xs text-canvas/70">{groupItem.descrizione || 'Nessuna descrizione'}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-canvas/55">
                  #{groupItem.id_gruppo} • {groupItem.privacy} • Membri: {groupItem.members_count} • Budget iniziale: {groupItem.budget_iniziale}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      {confirmBanTarget ? (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-rose-300/60 bg-rose-950/95 p-4 shadow-2xl shadow-black/60">
          <p className="text-sm font-bold text-rose-100">Conferma di sicurezza</p>
          <p className="mt-1 text-sm text-rose-100/85">
            Stai per {confirmBanTarget.is_banned ? 'sbloccare' : 'bannare'} l'account <strong>{confirmBanTarget.username}</strong>.
          </p>
          <form onSubmit={handleConfirmBan} className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={banActionLoading}
              onClick={() => setConfirmBanTarget(null)}
              className="rounded-md border border-canvas/30 px-3 py-1.5 text-xs font-semibold text-canvas/80"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={banActionLoading}
              className="rounded-md border border-rose-300/60 bg-rose-500/25 px-3 py-1.5 text-xs font-bold text-rose-100"
            >
              {banActionLoading ? 'Conferma in corso...' : 'Conferma'}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
