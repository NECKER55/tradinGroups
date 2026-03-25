import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { useNavigate, useParams } from 'react-router-dom';
import Counter from '../../../shared/components/Counter';
import LightRays from '../../../shared/components/LightRays';
import { useAuth } from '../../auth/context/AuthContext';
import {
  cancelGroupInvite,
  GroupMember,
  GroupProfile,
  GroupRankingItem,
  GroupWorkspaceHistoryPoint,
  GroupWorkspaceHolding,
  GroupWorkspaceTransaction,
  GroupWorkspaceWatchlistItem,
  demoteGroupMember,
  getGroupMembers,
  getGroupProfile,
  getGroupRanking,
  getGroupWorkspace,
  invitePersonToGroup,
  leaveGroup,
  leaveGroupWithPayload,
  promoteGroupMember,
  removeGroupMember,
  updateGroupDescription,
  updateGroupMemberBudget,
  updateGroupName,
  updateGroupPhoto,
} from '../api/groupDetailApi';
import { StockSearchItem, searchStocks } from '../../home/api/personalWorkspaceApi';
import { getMySentGroupInvites, PeopleSearchResult, searchPeople } from '../../social/api/socialHubApi';

type WorkspaceTab = 'assets' | 'history' | 'watchlist';
type RangeKey = '1W' | '1M' | '1Y' | 'ALL';
type BudgetAction = 'deposit' | 'withdraw';

type PendingAction =
  | { kind: 'leave'; newOwnerId: number | null }
  | { kind: 'expel'; member: GroupMember }
  | { kind: 'promote'; member: GroupMember }
  | { kind: 'demote'; member: GroupMember }
  | { kind: 'bulkBudget'; targetIds: number[]; amount: number; budgetAction: BudgetAction }
  | { kind: 'updateGroup'; field: 'name' | 'description' | 'photo'; value: string | null };

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildSeries(history: GroupWorkspaceHistoryPoint[], range: RangeKey): { labels: string[]; values: number[] } {
  const dayMap = new Map<string, number>();
  const monthMap = new Map<string, number>();

  for (const row of history) {
    const value = toNumber(row.valore_totale);
    dayMap.set(row.data, value);
    monthMap.set(row.data.slice(0, 7), value);
  }

  const now = new Date();

  if (range === '1W' || range === '1M') {
    const span = range === '1W' ? 7 : 30;
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
      values.push(dayMap.get(dateKey(d)) ?? 0);
    }
    return { labels, values };
  }

  if (range === '1Y') {
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('en-US', { month: 'short' }).toUpperCase());
      values.push(monthMap.get(monthKey(d)) ?? 0);
    }
    return { labels, values };
  }

  const first = history.length ? new Date(history[0].data) : new Date(now.getFullYear(), now.getMonth(), 1);
  const labels: string[] = [];
  const values: number[] = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    labels.push(`${cursor.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(cursor.getFullYear()).slice(-2)}`);
    values.push(monthMap.get(monthKey(cursor)) ?? 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { labels, values };
}

function roleBadgeClass(role: string): string {
  if (role === 'Owner') return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  if (role === 'Admin') return 'border-violet-400/40 bg-violet-500/10 text-violet-200';
  return 'border-slate-500/30 bg-slate-600/10 text-slate-300';
}

export function GroupDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groupId } = useParams();
  const groupContainerRef = useRef<HTMLElement | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('assets');
  const [range, setRange] = useState<RangeKey>('1M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [group, setGroup] = useState<GroupProfile | null>(null);
  const [ranking, setRanking] = useState<GroupRankingItem[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [workspaceHoldings, setWorkspaceHoldings] = useState<GroupWorkspaceHolding[]>([]);
  const [workspaceHistory, setWorkspaceHistory] = useState<GroupWorkspaceHistoryPoint[]>([]);
  const [workspaceTransactions, setWorkspaceTransactions] = useState<GroupWorkspaceTransaction[]>([]);
  const [workspaceWatchlist, setWorkspaceWatchlist] = useState<GroupWorkspaceWatchlistItem[]>([]);
  const [groupRole, setGroupRole] = useState<GroupMember['ruolo'] | null>(null);
  const [cash, setCash] = useState(0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [memberBudgetAmount, setMemberBudgetAmount] = useState('100.00');
  const [memberBudgetAction, setMemberBudgetAction] = useState<BudgetAction>('deposit');
  const [applyToAllMembers, setApplyToAllMembers] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [inviteTerm, setInviteTerm] = useState('');
  const [inviteResults, setInviteResults] = useState<PeopleSearchResult[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSendingId, setInviteSendingId] = useState<number | null>(null);
  const [inviteCancellingId, setInviteCancellingId] = useState<number | null>(null);
  const [sentInviteIds, setSentInviteIds] = useState<number[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');

  const parsedGroupId = Number(groupId);

  async function refreshAll(groupNumericId: number) {
    const [profile, rankingRes, workspace, membersRes] = await Promise.all([
      getGroupProfile(groupNumericId),
      getGroupRanking(groupNumericId),
      getGroupWorkspace(groupNumericId),
      getGroupMembers(groupNumericId),
    ]);

    setGroup(profile.group);
    setRanking(rankingRes.ranking);
    setWorkspaceHoldings(workspace.holdings);
    setWorkspaceHistory(workspace.history);
    setWorkspaceTransactions(workspace.transactions);
    setWorkspaceWatchlist(workspace.watchlist);
    setCash(toNumber(workspace.portfolio.liquidita));
    setMembers(membersRes.members);

    setEditName(profile.group.nome);
    setEditDescription(profile.group.descrizione ?? '');
    setEditPhotoUrl(profile.group.photo_url ?? '');
  }

  useEffect(() => {
    if (!Number.isFinite(parsedGroupId)) {
      setLoading(false);
      setError('ID gruppo non valido.');
      return;
    }

    let active = true;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      setBanner(null);
      try {
        await refreshAll(parsedGroupId);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Impossibile caricare il gruppo.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [parsedGroupId]);

  useEffect(() => {
    const ownRole = members.find((m) => m.id_persona === user?.id_persona)?.ruolo ?? null;
    setGroupRole(ownRole);
  }, [members, user?.id_persona]);

  useEffect(() => {
    if (!settingsOpen) return;
    if (!Number.isFinite(parsedGroupId)) return;

    if (groupRole === 'Owner' || groupRole === 'Admin') {
      void getMySentGroupInvites().then((res) => {
        const ids = res.invites
          .filter((invite) => invite.id_gruppo === parsedGroupId)
          .map((invite) => invite.invitato.id_persona);
        setSentInviteIds(ids);
      }).catch(() => {
        setSentInviteIds([]);
      });
    }
  }, [groupRole, parsedGroupId, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const q = inviteTerm.trim();

    if (!q) {
      setInviteResults([]);
      setInviteLoading(false);
      return;
    }

    let active = true;
    setInviteLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchPeople(q, 25);
        if (!active) return;
        setInviteResults(res.results);
      } catch {
        if (!active) return;
        setInviteResults([]);
      } finally {
        if (active) setInviteLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inviteTerm, settingsOpen]);

  useEffect(() => {
    const q = searchTerm.trim();

    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await searchStocks(q, 25);
        if (!active) return;
        setSearchResults(result.results);
        setSearchError(null);
      } catch (err) {
        if (!active) return;
        setSearchError(err instanceof Error ? err.message : 'Errore ricerca titoli.');
        setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 3800);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    const root = groupContainerRef.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('button, .rounded-xl, .rounded-2xl, .violet-underlight, .group-glow-card'),
    ).filter((el) => !el.classList.contains('group-glow-ignore'));

    targets.forEach((el) => el.classList.add('social-glow-card'));

    const proximity = 230;
    const fadeDistance = 420;
    let rafId: number | null = null;
    let lastEvent: MouseEvent | null = null;

    const updateGlow = () => {
      if (!lastEvent) return;
      const mouseX = lastEvent.clientX;
      const mouseY = lastEvent.clientY;

      gsap.set(root, {
        '--spot-x': `${mouseX}px`,
        '--spot-y': `${mouseY}px`,
        '--spot-opacity': 1,
      });

      for (const el of targets) {
        const rect = el.getBoundingClientRect();
        const dx = Math.max(rect.left - mouseX, 0, mouseX - rect.right);
        const dy = Math.max(rect.top - mouseY, 0, mouseY - rect.bottom);
        const distance = Math.hypot(dx, dy);

        let intensity = 0;
        if (distance <= proximity) {
          intensity = 1;
        } else if (distance <= fadeDistance) {
          intensity = (fadeDistance - distance) / (fadeDistance - proximity);
        }

        const relativeX = ((mouseX - rect.left) / rect.width) * 100;
        const relativeY = ((mouseY - rect.top) / rect.height) * 100;

        gsap.set(el, {
          '--glow-intensity': Number(intensity.toFixed(3)),
          '--glow-x': `${Math.max(0, Math.min(100, relativeX))}%`,
          '--glow-y': `${Math.max(0, Math.min(100, relativeY))}%`,
        });
      }

      rafId = null;
    };

    const onMouseMove = (event: MouseEvent) => {
      lastEvent = event;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateGlow);
    };

    const onMouseLeave = () => {
      targets.forEach((el) => {
        gsap.to(el, {
          '--glow-intensity': 0,
          duration: 0.25,
          ease: 'power2.out',
        });
      });

      gsap.to(root, {
        '--spot-opacity': 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    root.classList.add('social-glow-scope');
    root.addEventListener('mousemove', onMouseMove);
    root.addEventListener('mouseleave', onMouseLeave);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      root.removeEventListener('mousemove', onMouseMove);
      root.removeEventListener('mouseleave', onMouseLeave);
      targets.forEach((el) => el.classList.remove('social-glow-card'));
      root.classList.remove('social-glow-scope');
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen && !pendingAction) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pendingAction, settingsOpen]);

  const chart = useMemo(() => buildSeries(workspaceHistory, range), [workspaceHistory, range]);
  const maxChart = Math.max(1, ...chart.values);
  const minChart = Math.min(...chart.values, 0);
  const chartSpan = Math.max(1, maxChart - minChart);

  const totalWealth = workspaceHistory.length
    ? toNumber(workspaceHistory[workspaceHistory.length - 1].valore_totale)
    : cash;

  const polylinePoints = chart.values
    .map((value, index) => {
      const x = chart.values.length > 1 ? (index / (chart.values.length - 1)) * 100 : 0;
      const y = 100 - ((value - minChart) / chartSpan) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${polylinePoints} 100,100 0,100`;

  const isOwner = groupRole === 'Owner';
  const isAdmin = groupRole === 'Admin' || isOwner;

  const memberIdsSet = useMemo(() => new Set(members.map((m) => m.id_persona)), [members]);

  function toggleSelectMember(idPersona: number) {
    setSelectedMemberIds((prev) => (prev.includes(idPersona)
      ? prev.filter((id) => id !== idPersona)
      : [...prev, idPersona]));
  }

  function queueBulkBudgetConfirmation() {
    if (!Number.isFinite(parsedGroupId)) return;

    const amount = Number(memberBudgetAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBanner('Inserisci un importo valido maggiore di 0.');
      return;
    }

    const targetIds = applyToAllMembers ? members.map((m) => m.id_persona) : selectedMemberIds;

    if (targetIds.length === 0) {
      setBanner('Seleziona almeno un membro o attiva Apply to all.');
      return;
    }

    setPendingAction({
      kind: 'bulkBudget',
      targetIds,
      amount,
      budgetAction: memberBudgetAction,
    });
  }

  function queueGroupUpdateConfirmation(field: 'name' | 'description' | 'photo') {
    if (field === 'name') {
      const next = editName.trim();
      if (next.length < 3) {
        setBanner('Il nome gruppo deve avere almeno 3 caratteri.');
        return;
      }
      setPendingAction({ kind: 'updateGroup', field, value: next });
      return;
    }

    if (field === 'description') {
      setPendingAction({ kind: 'updateGroup', field, value: editDescription.trim() || null });
      return;
    }

    setPendingAction({ kind: 'updateGroup', field, value: editPhotoUrl.trim() || null });
  }

  async function handleInviteMember(person: PeopleSearchResult) {
    if (!Number.isFinite(parsedGroupId)) return;

    if (memberIdsSet.has(person.id_persona)) {
      setBanner('Utente gia membro del gruppo.');
      return;
    }

    if (sentInviteIds.includes(person.id_persona)) {
      setBanner('Invito gia inviato a questo utente.');
      return;
    }

    setInviteSendingId(person.id_persona);
    setBanner(null);

    try {
      const res = await invitePersonToGroup(parsedGroupId, person.id_persona);
      setBanner(res.message);
      setSentInviteIds((prev) => [...new Set([...prev, person.id_persona])]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invio invito non riuscito.';
      setBanner(message);
    } finally {
      setInviteSendingId(null);
    }
  }

  async function handleCancelInvite(person: PeopleSearchResult) {
    if (!Number.isFinite(parsedGroupId)) return;

    setInviteCancellingId(person.id_persona);
    setBanner(null);

    try {
      const res = await cancelGroupInvite(parsedGroupId, person.id_persona);
      setBanner(res.message);
      setSentInviteIds((prev) => prev.filter((id) => id !== person.id_persona));
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Annullamento invito non riuscito.');
    } finally {
      setInviteCancellingId(null);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    if (!Number.isFinite(parsedGroupId)) return;

    setActionLoading(true);
    setBanner(null);

    try {
      if (pendingAction.kind === 'expel') {
        const res = await removeGroupMember(parsedGroupId, pendingAction.member.id_persona);
        setBanner(res.message);
      } else if (pendingAction.kind === 'promote') {
        const res = await promoteGroupMember(parsedGroupId, pendingAction.member.id_persona);
        setBanner(res.message);
      } else if (pendingAction.kind === 'demote') {
        const res = await demoteGroupMember(parsedGroupId, pendingAction.member.id_persona);
        setBanner(res.message);
      } else if (pendingAction.kind === 'bulkBudget') {
        const delta = pendingAction.budgetAction === 'withdraw' ? -pendingAction.amount : pendingAction.amount;
        const results = await Promise.allSettled(
          pendingAction.targetIds.map((personId) => updateGroupMemberBudget(parsedGroupId, {
            id_persona: personId,
            delta_budget: delta.toFixed(2),
          })),
        );

        const failed = results.filter((r) => r.status === 'rejected').length;
        const success = results.length - failed;
        setBanner(failed > 0
          ? `Operazione completata parzialmente: ${success} successi, ${failed} falliti.`
          : `Operazione eseguita su ${success} membri.`);
      } else if (pendingAction.kind === 'updateGroup') {
        if (pendingAction.field === 'name') {
          const res = await updateGroupName(parsedGroupId, pendingAction.value ?? '');
          setBanner(res.message);
        } else if (pendingAction.field === 'description') {
          const res = await updateGroupDescription(parsedGroupId, pendingAction.value);
          setBanner(res.message);
        } else {
          const res = await updateGroupPhoto(parsedGroupId, pendingAction.value);
          setBanner(res.message);
        }
      } else {
        if (isOwner && members.length > 1) {
          if (!pendingAction.newOwnerId || pendingAction.newOwnerId === user?.id_persona) {
            setBanner('Se sei owner devi selezionare un nuovo owner valido prima di uscire.');
            setActionLoading(false);
            return;
          }

          const res = await leaveGroupWithPayload(parsedGroupId, { new_owner_id: pendingAction.newOwnerId });
          setPendingAction(null);
          setBanner(res.message);
          navigate('/social');
          return;
        }

        const res = await leaveGroup(parsedGroupId);
        setPendingAction(null);
        setBanner(res.message);
        navigate('/social');
        return;
      }

      await refreshAll(parsedGroupId);
      setPendingAction(null);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section ref={groupContainerRef} className="social-glow-scope relative mx-auto w-full max-w-[1250px] space-y-7 px-6 py-8 text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-70">
        <LightRays
          raysOrigin="top-center"
          raysColor="#813d9c"
          raysSpeed={1.3}
          lightSpread={1.1}
          rayLength={3}
          followMouse
          mouseInfluence={0.1}
          noiseAmount={0}
          distortion={0}
          pulsating={false}
          fadeDistance={1.3}
          saturation={1}
        />
      </div>

      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(60rem_35rem_at_50%_-5%,rgba(129,61,156,0.26),transparent_72%)]" />

      <div className="relative z-10 space-y-7">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Torna indietro"
            className="group-glow-ignore inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>

          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#25263a] bg-[#121422]/90 px-3 py-2">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-500/35 bg-[#1a1d2d] text-xs font-black text-violet-200">
              {group?.photo_url ? <img src={group.photo_url} alt={group.nome} className="h-full w-full object-cover" /> : (group?.nome ?? 'G').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-100">{group?.nome ?? `Group #${groupId}`}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-200">{group?.privacy ?? 'Private'}</span>
                {groupRole ? <span className={`rounded-full border px-2 py-0.5 ${roleBadgeClass(groupRole)}`}>{groupRole}</span> : null}
              </div>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Apri impostazioni gruppo"
            className="group-glow-card inline-flex h-11 w-11 items-center justify-center rounded-full border border-violet-500/35 bg-violet-500/12 text-violet-200 transition-colors hover:bg-violet-500/20"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-400">Caricamento dati gruppo...</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        {!loading && !error ? (
          <>
            <section className="space-y-5">
              <h2 className="text-2xl font-black uppercase tracking-tight text-violet-200">Group Leaderboard</h2>
              <div className="overflow-hidden rounded-2xl border border-[#232337] bg-[#10111a]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#25263a] bg-[#17182a] text-xs uppercase tracking-[0.18em] text-violet-300/80">
                        <th className="px-6 py-4">Rank</th>
                        <th className="px-6 py-4">Member</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-right">Portfolio Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202131]">
                      {ranking.length === 0 ? (
                        <tr>
                          <td className="px-6 py-6 text-slate-400" colSpan={4}>Nessun membro disponibile.</td>
                        </tr>
                      ) : (
                        ranking.map((member) => (
                          <tr key={member.id_persona} className="bg-[#0f1018] transition-colors hover:bg-[#161829]">
                            <td className="px-6 py-4">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/12 text-xs font-black text-violet-200">
                                {String(member.posizione).padStart(2, '0')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-100">{member.username}</p>
                              <p className="text-xs text-slate-500">ID {member.id_persona}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${roleBadgeClass(member.ruolo)}`}>{member.ruolo}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-100">{toCurrency(toNumber(member.valore_totale))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div className="rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-5">
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search stocks, ETFs..."
                  className="w-full rounded-xl border border-[#1f1f2e] bg-[#0f0f14] py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              {searchLoading ? <p className="mt-3 text-xs text-slate-400">Ricerca in corso...</p> : null}
              {searchError ? <p className="mt-3 text-xs text-rose-400">{searchError}</p> : null}

              {searchTerm.trim() && !searchLoading && !searchError ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-slate-400">Nessun titolo trovato.</p>
                  ) : (
                    searchResults.map((stock) => (
                      <div
                        key={stock.id_stock}
                        onClick={() => navigate(`/stocks/${stock.id_stock}`, {
                          state: {
                            stock,
                            context: { scope: 'group', groupId: parsedGroupId },
                          },
                        })}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[#232337] bg-[#0f0f14] px-3 py-2 transition-colors hover:bg-[#1a1a27]"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{stock.nome_societa}</p>
                          <p className="text-[11px] uppercase tracking-wider text-slate-500">{stock.settore}</p>
                        </div>
                        <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-200">
                          {stock.id_stock}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <section id="group-workspace" className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Group Portfolio Workspace</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Total Wealth (Group Portfolio)</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="flex items-center text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
                    <span className="mr-1">$</span>
                    <Counter
                      value={totalWealth}
                      fontSize={44}
                      padding={4}
                      gap={1}
                      textColor="rgb(241 245 249)"
                      fontWeight={800}
                      digitPlaceHolders
                      gradientHeight={8}
                      gradientFrom="rgba(17, 24, 39, 0.6)"
                      gradientTo="transparent"
                      counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
                    />
                  </h3>
                </div>
                <p className="flex items-center text-sm text-slate-300">
                  Cash Balance:
                  <span className="ml-2 inline-flex items-center font-bold text-slate-100">
                    <span className="mr-0.5">$</span>
                    <Counter
                      value={cash}
                      fontSize={16}
                      padding={2}
                      gap={1}
                      textColor="rgb(241 245 249)"
                      fontWeight={700}
                      digitPlaceHolders
                      gradientHeight={4}
                      gradientFrom="rgba(15, 15, 20, 0.8)"
                      gradientTo="transparent"
                      counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
                    />
                  </span>
                </p>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-6">
                <div className="absolute -left-24 -top-24 size-48 bg-violet-500/10 blur-[100px]" />
                <div className="relative z-10 mb-8 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-100">Group Portfolio Performance</h3>
                  <div className="flex rounded-lg border border-[#1f1f2e] bg-[#0a0a0c]/60 p-1">
                    {(['1W', '1M', '1Y', 'ALL'] as RangeKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setRange(key)}
                        className={`rounded-md px-4 py-1.5 text-xs font-bold ${range === key ? 'bg-violet-500 text-white' : 'text-slate-500 hover:text-slate-100'}`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 h-[280px] w-full">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="groupChartFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="20" x2="100" y2="20" stroke="#1f1f2e" strokeDasharray="1.5 1.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#1f1f2e" strokeDasharray="1.5 1.5" />
                    <line x1="0" y1="80" x2="100" y2="80" stroke="#1f1f2e" strokeDasharray="1.5 1.5" />
                    <polygon points={areaPoints} fill="url(#groupChartFill)" />
                    <polyline points={polylinePoints} fill="none" stroke="#a855f7" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="relative z-10 mt-4 flex justify-between gap-2 overflow-x-auto text-[11px] font-medium uppercase tracking-widest text-slate-500">
                  {chart.labels.map((label, idx) => (
                    <span key={`${label}-${idx}`} className="shrink-0">{label}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="inline-flex space-x-1 rounded-full border border-violet-500/25 bg-[#0d0d14] p-1">
                  {[
                    { id: 'assets' as WorkspaceTab, label: 'Group Assets' },
                    { id: 'history' as WorkspaceTab, label: 'Group Transactions' },
                    { id: 'watchlist' as WorkspaceTab, label: 'Watchlist' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-slate-100'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'assets' ? (
                  <div className="grid grid-cols-1 gap-4">
                    {workspaceHoldings.length === 0 ? <p className="text-sm text-slate-400">Nessuna azione in possesso nel portafoglio gruppo.</p> : null}
                    {workspaceHoldings.map((item) => (
                      <div
                        key={item.id_stock}
                        onClick={() => navigate(`/stocks/${item.id_stock}`, {
                          state: {
                            stock: item,
                            context: { scope: 'group', groupId: parsedGroupId },
                          },
                        })}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4 transition-all hover:bg-[#1f1f2e]/40"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-[#0a0a0c]">{item.id_stock}</div>
                          <div>
                            <h4 className="font-bold text-slate-100">{item.nome_societa}</h4>
                            <p className="text-xs text-slate-500">{toNumber(item.numero).toFixed(6)} Shares</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-100">{toCurrency(toNumber(item.prezzo_medio_acquisto))}</p>
                          <p className="text-xs font-semibold text-slate-400">Avg Buy Price</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeTab === 'history' ? (
                  <div className="overflow-hidden rounded-xl border border-[#1f1f2e]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#1f1f2e] bg-[#13131a] text-xs uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Ticker</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Quantity</th>
                            <th className="px-4 py-3 text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f1f2e] bg-[#0f0f14]">
                          {workspaceTransactions.length === 0 ? (
                            <tr>
                              <td className="px-4 py-4 text-slate-400" colSpan={6}>Nessuna transazione disponibile.</td>
                            </tr>
                          ) : (
                            workspaceTransactions.map((tx) => (
                              <tr key={tx.id_transazione} className="hover:bg-[#1f1f2e]/35">
                                <td className="px-4 py-3 text-slate-300">{new Date(tx.created_at).toLocaleString('it-IT')}</td>
                                <td className="px-4 py-3 font-semibold text-slate-100">{tx.id_stock}</td>
                                <td className={`px-4 py-3 font-semibold ${tx.tipo === 'Buy' ? 'text-violet-400' : 'text-rose-400'}`}>{tx.tipo}</td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tx.stato === 'Executed' ? 'bg-emerald-500/15 text-emerald-300' : tx.stato === 'Pending' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>
                                    {tx.stato}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-300">{tx.quantita_azioni ? toNumber(tx.quantita_azioni).toFixed(6) : '--'}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-100">
                                  {tx.stato === 'Executed'
                                    ? toCurrency(tx.tipo === 'Buy'
                                      ? toNumber(tx.importo_investito)
                                      : toNumber(tx.quantita_azioni) * toNumber(tx.prezzo_esecuzione))
                                    : (tx.tipo === 'Buy' ? toCurrency(toNumber(tx.importo_investito)) : '--')}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'watchlist' ? (
                  <div className="grid grid-cols-1 gap-4">
                    {workspaceWatchlist.length === 0 ? <p className="text-sm text-slate-400">Watchlist vuota.</p> : null}
                    {workspaceWatchlist.map((row) => (
                      <div
                        key={row.id_stock}
                        onClick={() => navigate(`/stocks/${row.id_stock}`, {
                          state: {
                            stock: row,
                            context: { scope: 'group', groupId: parsedGroupId },
                          },
                        })}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4 transition-colors hover:bg-[#1f1f2e]/40"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-[#0a0a0c]">{row.id_stock}</div>
                          <div>
                            <p className="text-sm font-bold text-slate-100">{row.nome_societa}</p>
                            <p className="text-[10px] uppercase text-slate-500">{row.settore}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-violet-400">In Watchlist</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {settingsOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[108] bg-black/70"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="mx-auto mt-16 max-h-[82vh] w-[min(1100px,94vw)] overflow-y-auto rounded-2xl border border-[#232337] bg-[#0f1018] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/85">Group Settings</p>
                  <p className="text-sm text-slate-400">Pannello gestione clan con permessi per ruolo.</p>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-violet-500/30 bg-violet-500/12 text-violet-200 hover:bg-violet-500/20"
                  aria-label="Chiudi impostazioni"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Clan Details</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-violet-500/35 bg-[#1a1d2d] text-sm font-black text-violet-200">
                        {group?.photo_url ? <img src={group.photo_url} alt={group.nome} className="h-full w-full object-cover" /> : (group?.nome ?? 'G').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-100">{group?.nome}</p>
                        <p className="text-xs text-slate-400">{group?.descrizione || 'Nessuna descrizione gruppo.'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Your Role</p>
                    <p className="mt-2 text-2xl font-black text-violet-200">{groupRole ?? 'Unknown'}</p>
                    <button
                      onClick={() => setPendingAction({ kind: 'leave', newOwnerId: null })}
                      className="mt-4 w-full rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs font-bold uppercase tracking-wide text-rose-200 transition-colors hover:bg-rose-500/20"
                    >
                      Leave Group
                    </button>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Group Profile Edit</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-[#2a2c44] bg-[#141728] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Name</p>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-2 w-full rounded-md border border-[#34375a] bg-[#0d1020] px-2 py-1.5 text-sm text-slate-100"
                        />
                        <button
                          onClick={() => queueGroupUpdateConfirmation('name')}
                          className="mt-2 w-full rounded-md border border-violet-500/35 bg-violet-500/12 px-2 py-1.5 text-xs font-bold uppercase text-violet-200"
                        >
                          Save name
                        </button>
                      </div>
                      <div className="rounded-lg border border-[#2a2c44] bg-[#141728] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Description</p>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={3}
                          className="mt-2 w-full rounded-md border border-[#34375a] bg-[#0d1020] px-2 py-1.5 text-sm text-slate-100"
                        />
                        <button
                          onClick={() => queueGroupUpdateConfirmation('description')}
                          className="mt-2 w-full rounded-md border border-violet-500/35 bg-violet-500/12 px-2 py-1.5 text-xs font-bold uppercase text-violet-200"
                        >
                          Save description
                        </button>
                      </div>
                      <div className="rounded-lg border border-[#2a2c44] bg-[#141728] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Photo URL</p>
                        <input
                          value={editPhotoUrl}
                          onChange={(e) => setEditPhotoUrl(e.target.value)}
                          className="mt-2 w-full rounded-md border border-[#34375a] bg-[#0d1020] px-2 py-1.5 text-sm text-slate-100"
                        />
                        <button
                          onClick={() => queueGroupUpdateConfirmation('photo')}
                          className="mt-2 w-full rounded-md border border-violet-500/35 bg-violet-500/12 px-2 py-1.5 text-xs font-bold uppercase text-violet-200"
                        >
                          Save photo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isAdmin ? (
                  <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Invite People</p>
                    <div className="mt-3 rounded-xl border border-[#24263a] bg-[#0f111b] p-3">
                      <input
                        value={inviteTerm}
                        onChange={(e) => setInviteTerm(e.target.value)}
                        className="w-full rounded-lg border border-[#2a2c44] bg-[#171a2a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                        placeholder="Search user by username or id"
                      />
                      {inviteLoading ? <p className="mt-2 text-xs text-slate-400">Ricerca...</p> : null}
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {inviteResults.map((person) => {
                          const alreadyMember = memberIdsSet.has(person.id_persona);
                          const alreadyInvited = sentInviteIds.includes(person.id_persona);

                          return (
                            <div key={person.id_persona} className="flex items-center justify-between rounded-lg border border-[#2a2c44] bg-[#141728] p-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-100">{person.username}</p>
                                <p className="text-[11px] text-slate-400">ID {person.id_persona}</p>
                                <div className="mt-1 flex gap-1">
                                  {alreadyMember ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase text-emerald-200">Member</span> : null}
                                  {alreadyInvited ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-200">Invited</span> : null}
                                </div>
                              </div>
                              <button
                                onClick={() => void handleInviteMember(person)}
                                disabled={inviteSendingId === person.id_persona || inviteCancellingId === person.id_persona || alreadyMember || alreadyInvited}
                                className="rounded-md border border-violet-500/35 bg-violet-500/15 px-2 py-1 text-[11px] font-bold uppercase text-violet-200 transition-colors hover:bg-violet-500/25 disabled:opacity-60"
                              >
                                Invite
                              </button>
                              {alreadyInvited && !alreadyMember ? (
                                <button
                                  onClick={() => void handleCancelInvite(person)}
                                  disabled={inviteCancellingId === person.id_persona || inviteSendingId === person.id_persona}
                                  className="ml-2 rounded-md border border-rose-500/35 bg-rose-500/12 px-2 py-1 text-[11px] font-bold uppercase text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
                                >
                                  Cancel invite
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isAdmin ? (
                  <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Member Budget Control</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                      <input
                        value={memberBudgetAmount}
                        onChange={(e) => setMemberBudgetAmount(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-10 rounded-lg border border-[#2a2c44] bg-[#171a2a] px-3 text-sm text-slate-100 outline-none focus:border-violet-500"
                        placeholder="Amount"
                      />
                      <select
                        value={memberBudgetAction}
                        onChange={(e) => setMemberBudgetAction(e.target.value as BudgetAction)}
                        className="h-10 rounded-lg border border-[#2a2c44] bg-[#171a2a] px-3 text-sm text-slate-100 outline-none"
                      >
                        <option value="deposit">Deposit</option>
                        <option value="withdraw">Withdraw</option>
                      </select>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-[#2a2c44] bg-[#171a2a] px-3 text-sm text-slate-100">
                        <input
                          type="checkbox"
                          checked={applyToAllMembers}
                          onChange={(e) => setApplyToAllMembers(e.target.checked)}
                          className="h-4 w-4 rounded border-[#3b3e5e] bg-[#0d1020]"
                        />
                        Apply to all
                      </label>
                      <button
                        onClick={queueBulkBudgetConfirmation}
                        className="h-10 rounded-lg border border-violet-500/35 bg-violet-500/20 px-4 text-sm font-bold text-violet-200 transition-colors hover:bg-violet-500/30"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-[#24263a] bg-[#131522] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/80">Members</p>
                  <div className="mt-3 space-y-2">
                    {members.map((member) => {
                      const isSelf = member.id_persona === user?.id_persona;
                      const adminCanExpel = isAdmin && !isOwner && member.ruolo === 'User' && !isSelf;
                      const ownerCanExpel = isOwner && member.ruolo !== 'Owner' && !isSelf;

                      return (
                        <div key={member.id_persona} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2a2c44] bg-[#141728] px-3 py-2">
                          <div className="flex items-center gap-3">
                            {isAdmin && !applyToAllMembers ? (
                              <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(member.id_persona)}
                                onChange={() => toggleSelectMember(member.id_persona)}
                                className="h-4 w-4 rounded border-[#3b3e5e] bg-[#0d1020]"
                              />
                            ) : null}
                            <div>
                              <p className="text-sm font-bold text-slate-100">{member.username}{isSelf ? ' (you)' : ''}</p>
                              <p className="text-[11px] text-slate-400">ID {member.id_persona}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass(member.ruolo)}`}>{member.ruolo}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-500/30 bg-slate-600/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                              Portfolio #{member.id_portafoglio ?? '-'}
                            </span>
                            {isAdmin ? (
                              <>
                                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">
                                  Budget: {toCurrency(toNumber(member.budget_iniziale))}
                                </span>
                                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                                  Cash: {toCurrency(toNumber(member.portfolio_liquidita))}
                                </span>
                              </>
                            ) : null}

                            {(adminCanExpel || ownerCanExpel) ? (
                              <button
                                onClick={() => setPendingAction({ kind: 'expel', member })}
                                className="rounded-md border border-rose-500/35 bg-rose-500/12 px-2 py-1 text-[11px] font-bold uppercase text-rose-200 transition-colors hover:bg-rose-500/20"
                              >
                                Expel
                              </button>
                            ) : null}

                            {isOwner && !isSelf && member.ruolo !== 'Owner' ? (
                              <button
                                onClick={() => setPendingAction({ kind: 'promote', member })}
                                className="rounded-md border border-violet-500/35 bg-violet-500/12 px-2 py-1 text-[11px] font-bold uppercase text-violet-200 transition-colors hover:bg-violet-500/20"
                              >
                                Promote
                              </button>
                            ) : null}

                            {isOwner && !isSelf && member.ruolo === 'Admin' ? (
                              <button
                                onClick={() => setPendingAction({ kind: 'demote', member })}
                                className="rounded-md border border-amber-500/35 bg-amber-500/12 px-2 py-1 text-[11px] font-bold uppercase text-amber-200 transition-colors hover:bg-amber-500/20"
                              >
                                Demote
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {banner ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-4 right-4 z-[120] w-[min(520px,90vw)] rounded-xl border border-violet-500/35 bg-[#141529]/95 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-violet-300">info</span>
              <p className="flex-1 text-sm text-violet-100">{banner}</p>
              <button
                onClick={() => setBanner(null)}
                className="grid h-6 w-6 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-200"
                aria-label="Chiudi notifica"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingAction ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-5"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="w-full max-w-lg rounded-2xl border border-violet-500/30 bg-[#11131f] p-5"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">Confirm action</p>

              {pendingAction.kind === 'leave' ? (
                <>
                  <p className="mt-3 text-sm text-slate-200">Confermi di voler lasciare il gruppo?</p>
                  {isOwner && members.length > 1 ? (
                    <div className="mt-3 rounded-xl border border-[#2a2c44] bg-[#141728] p-3">
                      <p className="text-xs text-slate-300">Sei owner: seleziona il nuovo owner.</p>
                      <select
                        value={pendingAction.newOwnerId ?? ''}
                        onChange={(e) => setPendingAction({ kind: 'leave', newOwnerId: Number(e.target.value) || null })}
                        className="mt-2 w-full rounded-lg border border-[#34375a] bg-[#0d1020] px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="">Select new owner</option>
                        {members
                          .filter((m) => m.id_persona !== user?.id_persona)
                          .map((m) => <option key={m.id_persona} value={m.id_persona}>{m.username} ({m.ruolo})</option>)}
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}

              {pendingAction.kind === 'expel' ? <p className="mt-3 text-sm text-slate-200">Confermi espulsione di {pendingAction.member.username}?</p> : null}
              {pendingAction.kind === 'promote' ? <p className="mt-3 text-sm text-slate-200">Confermi promozione di {pendingAction.member.username}?</p> : null}
              {pendingAction.kind === 'demote' ? <p className="mt-3 text-sm text-slate-200">Confermi retrocessione di {pendingAction.member.username}?</p> : null}
              {pendingAction.kind === 'bulkBudget' ? (
                <p className="mt-3 text-sm text-slate-200">
                  Confermi {pendingAction.budgetAction === 'deposit' ? 'deposito' : 'prelievo'} di {toCurrency(pendingAction.amount)}
                  {' '}su {pendingAction.targetIds.length} membri?
                </p>
              ) : null}
              {pendingAction.kind === 'updateGroup' ? (
                <p className="mt-3 text-sm text-slate-200">
                  Confermi modifica {pendingAction.field === 'name' ? 'nome' : pendingAction.field === 'description' ? 'descrizione' : 'foto gruppo'}?
                </p>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => void confirmPendingAction()}
                  disabled={actionLoading}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-violet-600 disabled:opacity-60"
                >
                  {actionLoading ? 'Conferma...' : 'Conferma'}
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  disabled={actionLoading}
                  className="rounded-lg border border-[#2a2a39] bg-[#161824] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-colors hover:bg-[#1e2030] disabled:opacity-60"
                >
                  Annulla
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
