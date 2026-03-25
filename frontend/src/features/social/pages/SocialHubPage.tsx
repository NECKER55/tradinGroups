import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import {
  changeMyEmail,
  changeMyPassword,
  changeMyPhoto,
  changeMyUsername,
  setAccessToken,
} from '../../auth/api/authApi';
import {
  FriendshipRow,
  GroupInviteItem,
  GroupSummary,
  PeopleSearchResult,
  SentGroupInviteItem,
  acceptFriendRequest,
  acceptGroupInvite,
  blockFriendUser,
  cancelSentFriendRequest,
  cancelSentGroupInvite,
  createGroup,
  getMyFriendships,
  getMyGroups,
  getMyPendingGroupInvites,
  getMySentGroupInvites,
  invitePersonToGroup,
  rejectFriendRequest,
  rejectGroupInvite,
  searchGroups,
  searchPeople,
  sendFriendRequest,
} from '../api/socialHubApi';

type SearchMode = 'users' | 'groups';
type FriendRelationState = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
type GroupPrivacy = 'Public' | 'Private';
type InviteCandidateSource = 'search' | 'friends';

interface InviteCandidate extends PeopleSearchResult {
  source: InviteCandidateSource;
}

interface CreateGroupForm {
  nome: string;
  privacy: GroupPrivacy;
  photoUrl: string;
  descrizione: string;
  budgetIniziale: string;
}

interface AccountForm {
  username: string;
  email: string;
  photoUrl: string;
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

function avatarFallback(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function roleChipColor(role: string): string {
  if (role === 'Owner') return 'bg-violet-500/15 text-violet-200 border-violet-400/35';
  if (role === 'Admin') return 'bg-sky-500/15 text-sky-200 border-sky-400/35';
  return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35';
}

function parseBudget(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function toInviteCandidate(friend: FriendshipRow): InviteCandidate {
  return {
    id_persona: friend.id_persona,
    username: friend.username,
    photo_url: friend.photo_url,
    is_friend: true,
    source: 'friends',
  };
}

export function SocialHubPage() {
  const { user, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [myGroups, setMyGroups] = useState<Array<GroupSummary & { ruolo: string }>>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInviteItem[]>([]);
  const [sentGroupInvites, setSentGroupInvites] = useState<SentGroupInviteItem[]>([]);

  const [searchMode, setSearchMode] = useState<SearchMode>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [peopleResults, setPeopleResults] = useState<PeopleSearchResult[]>([]);
  const [groupResults, setGroupResults] = useState<GroupSummary[]>([]);

  const [requestsOpen, setRequestsOpen] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [blockingTarget, setBlockingTarget] = useState<{ id: number; username: string } | null>(null);

  const [friendActionId, setFriendActionId] = useState<number | null>(null);
  const [inviteActionId, setInviteActionId] = useState<number | null>(null);
  const [sentGroupInviteActionKey, setSentGroupInviteActionKey] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [inviteSearchTerm, setInviteSearchTerm] = useState('');
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviteSearchResults, setInviteSearchResults] = useState<PeopleSearchResult[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<InviteCandidate[]>([]);
  const [createForm, setCreateForm] = useState<CreateGroupForm>({
    nome: '',
    privacy: 'Private',
    photoUrl: '',
    descrizione: '',
    budgetIniziale: '0',
  });

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountBusyAction, setAccountBusyAction] = useState<'username' | 'email' | 'photo' | 'password' | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>({
    username: '',
    email: '',
    photoUrl: '',
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const photoUrlInputRef = useRef<HTMLInputElement | null>(null);
  const accountPhotoUrlInputRef = useRef<HTMLInputElement | null>(null);
  const socialContainerRef = useRef<HTMLElement | null>(null);
  const requestsButtonRef = useRef<HTMLButtonElement | null>(null);
  const invitesButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestsPanelRef = useRef<HTMLDivElement | null>(null);
  const invitesPanelRef = useRef<HTMLDivElement | null>(null);

  const refreshData = useCallback(async () => {
    const [friendshipsRes, myGroupsRes, invitesRes, sentInvitesRes] = await Promise.all([
      getMyFriendships(),
      getMyGroups(),
      getMyPendingGroupInvites(),
      getMySentGroupInvites(),
    ]);

    setFriendships(friendshipsRes.results);
    setMyGroups(myGroupsRes.groups);
    setGroupInvites(invitesRes.invites);
    setSentGroupInvites(sentInvitesRes.invites);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setLoadingError(null);

      try {
        await refreshData();
      } catch (err) {
        if (!active) return;
        setLoadingError(err instanceof Error ? err.message : 'Impossibile caricare la sezione social.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [refreshData]);

  useEffect(() => {
    const q = searchTerm.trim();

    if (!q) {
      setSearchError(null);
      setSearchLoading(false);
      setPeopleResults([]);
      setGroupResults([]);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        if (searchMode === 'users') {
          const res = await searchPeople(q, 30);
          if (!active) return;
          setPeopleResults(res.results);
          setGroupResults([]);
        } else {
          const res = await searchGroups(q, 30);
          if (!active) return;
          setGroupResults(res.results);
          setPeopleResults([]);
        }
        setSearchError(null);
      } catch (err) {
        if (!active) return;
        setSearchError(err instanceof Error ? err.message : 'Ricerca non riuscita.');
        setPeopleResults([]);
        setGroupResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 260);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchMode, searchTerm]);

  useEffect(() => {
    if (!createModalOpen) {
      setInviteSearchLoading(false);
      setInviteSearchResults([]);
      return;
    }

    const q = inviteSearchTerm.trim();
    if (!q) {
      setInviteSearchLoading(false);
      setInviteSearchResults([]);
      return;
    }

    let active = true;
    setInviteSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchPeople(q, 25);
        if (!active) return;
        setInviteSearchResults(res.results);
      } catch {
        if (!active) return;
        setInviteSearchResults([]);
      } finally {
        if (active) setInviteSearchLoading(false);
      }
    }, 260);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [createModalOpen, inviteSearchTerm]);

  useEffect(() => {
    if (!blockingTarget && !createModalOpen && !accountModalOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [blockingTarget, createModalOpen, accountModalOpen]);

  useEffect(() => {
    if (!banner && !loadingError) return;
    const timer = window.setTimeout(() => {
      setBanner(null);
      setLoadingError(null);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [banner, loadingError]);

  useEffect(() => {
    if (!requestsOpen && !invitesOpen) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        requestsOpen
        && requestsPanelRef.current
        && !requestsPanelRef.current.contains(target)
        && requestsButtonRef.current
        && !requestsButtonRef.current.contains(target)
      ) {
        setRequestsOpen(false);
      }

      if (
        invitesOpen
        && invitesPanelRef.current
        && !invitesPanelRef.current.contains(target)
        && invitesButtonRef.current
        && !invitesButtonRef.current.contains(target)
      ) {
        setInvitesOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [invitesOpen, requestsOpen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('account') === '1') {
      setAccountError(null);
      setAccountSuccess(null);
      setAccountBusyAction(null);
      setAccountForm({
        username: user?.username ?? '',
        email: user?.email ?? '',
        photoUrl: user?.photo_url ?? '',
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setAccountModalOpen(true);
    }
  }, [location.search, user?.email, user?.photo_url, user?.username]);

  useEffect(() => {
    const root = socialContainerRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.social-glow-card'));

    targets.forEach((el) => {
      el.classList.add('social-glow');
      el.style.setProperty('--glow-rgb', '132, 0, 255');
    });

    const proximity = 240;
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

    root.addEventListener('mousemove', onMouseMove);
    root.addEventListener('mouseleave', onMouseLeave);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      root.removeEventListener('mousemove', onMouseMove);
      root.removeEventListener('mouseleave', onMouseLeave);
      targets.forEach((el) => el.classList.remove('social-glow'));
    };
  }, []);

  function closeAccountModal() {
    setAccountModalOpen(false);
    // remove account query param from URL to avoid extra history entries
    try {
      navigate(location.pathname, { replace: true });
    } catch {
      // ignore navigation errors
    }
  }

  const friends = useMemo(
    () => friendships.filter((f) => f.status === 'Accepted' && !f.blocked_by_me),
    [friendships],
  );

  const incomingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'Pending' && f.direction === 'incoming' && !f.blocked_by_me),
    [friendships],
  );

  const outgoingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'Pending' && f.direction === 'outgoing' && !f.blocked_by_me),
    [friendships],
  );

  const requestBadgeCount = incomingRequests.length + outgoingRequests.length;
  const invitesBadgeCount = groupInvites.length + sentGroupInvites.length;

  const friendshipMap = useMemo(() => {
    const m = new Map<number, FriendshipRow>();
    for (const row of friendships) {
      m.set(row.id_persona, row);
    }
    return m;
  }, [friendships]);

  const selectedInviteeIds = useMemo(() => selectedInvitees.map((person) => person.id_persona), [selectedInvitees]);

  const inviteCandidates = useMemo(() => {
    const q = inviteSearchTerm.trim();

    if (!q) {
      return friends.map(toInviteCandidate);
    }

    if (inviteSearchResults.length > 0) {
      return inviteSearchResults.map((result) => ({ ...result, source: 'search' as const }));
    }

    return friends.map(toInviteCandidate);
  }, [friends, inviteSearchResults, inviteSearchTerm]);

  function userRelation(userId: number): FriendRelationState {
    if (user?.id_persona === userId) return 'self';
    const row = friendshipMap.get(userId);
    if (!row) return 'none';
    if (row.blocked_by_me) return 'none';
    if (row.status === 'Accepted') return 'friend';
    if (row.direction === 'incoming') return 'incoming';
    if (row.direction === 'outgoing') return 'outgoing';
    return 'none';
  }

  async function withAction(action: () => Promise<void>) {
    setLoadingError(null);
    setBanner(null);
    try {
      await action();
      await refreshData();
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  }

  function openCreateModal() {
    setCreateError(null);
    setInviteSearchTerm('');
    setInviteSearchResults([]);
    setSelectedInvitees([]);
    setCreateForm({
      nome: '',
      privacy: 'Private',
      photoUrl: '',
      descrizione: '',
      budgetIniziale: '0',
    });
    setCreateModalOpen(true);
  }

  function toggleInvitee(person: InviteCandidate) {
    setSelectedInvitees((prev) => {
      if (prev.some((item) => item.id_persona === person.id_persona)) {
        return prev.filter((item) => item.id_persona !== person.id_persona);
      }
      return [...prev, person];
    });
  }

  async function handleCreateGroup() {
    const groupName = createForm.nome.trim();
    if (groupName.length < 3) {
      setCreateError('Il nome gruppo deve avere almeno 3 caratteri.');
      return;
    }

    const budget = parseBudget(createForm.budgetIniziale);

    setCreatingGroup(true);
    setCreateError(null);

    try {
      const created = await createGroup({
        nome: groupName,
        privacy: createForm.privacy,
        photo_url: createForm.photoUrl.trim() || undefined,
        descrizione: createForm.descrizione.trim() || undefined,
        budget_iniziale: budget.toFixed(2),
      });

      const groupId = created.group.id_gruppo;

      if (selectedInvitees.length > 0) {
        const inviteResults = await Promise.allSettled(
          selectedInvitees.map((person) => invitePersonToGroup(groupId, person.id_persona)),
        );

        const failedInvites = inviteResults.filter((result) => result.status === 'rejected').length;
        if (failedInvites > 0) {
          setBanner(`Gruppo creato, ma ${failedInvites} inviti non sono stati inviati.`);
        }
      }

      await refreshData();
      setCreateModalOpen(false);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Impossibile creare il gruppo.');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleUpdateUsername() {
    const newUsername = accountForm.username.trim();
    if (newUsername.length < 3) {
      setAccountError('Username troppo corto. Minimo 3 caratteri.');
      return;
    }

    try {
      setAccountBusyAction('username');
      setAccountError(null);
      const response = await changeMyUsername(newUsername);
      setAccessToken(response.access_token);
      await refreshProfile();
      setAccountSuccess('Username aggiornato con successo.');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossibile aggiornare username.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleUpdatePhoto() {
    try {
      setAccountBusyAction('photo');
      setAccountError(null);
      await changeMyPhoto(accountForm.photoUrl.trim() || null);
      await refreshProfile();
      setAccountSuccess('Foto profilo aggiornata con successo.');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossibile aggiornare la foto.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleUpdateEmail() {
    const nextEmail = accountForm.email.trim();
    if (!nextEmail) {
      setAccountError('Inserisci una email valida.');
      return;
    }

    try {
      setAccountBusyAction('email');
      setAccountError(null);
      const response = await changeMyEmail(nextEmail);
      await refreshProfile();
      setAccountSuccess(response.message);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossibile aggiornare la email.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleUpdatePassword() {
    if (accountForm.newPassword.length < 8) {
      setAccountError('La nuova password deve avere almeno 8 caratteri.');
      return;
    }

    if (accountForm.newPassword !== accountForm.confirmNewPassword) {
      setAccountError('Le nuove password non coincidono.');
      return;
    }

    try {
      setAccountBusyAction('password');
      setAccountError(null);
      const response = await changeMyPassword(
        accountForm.oldPassword,
        accountForm.newPassword,
        accountForm.confirmNewPassword,
      );
      setAccountSuccess(response.message);
      setAccountForm((prev) => ({
        ...prev,
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossibile aggiornare la password.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleSendRequest(idPersona: number) {
    setFriendActionId(idPersona);
    await withAction(async () => {
      const res = await sendFriendRequest(idPersona);
      setBanner(res.message);
    });
    setFriendActionId(null);
  }

  async function handleAcceptRequest(idPersona: number) {
    setFriendActionId(idPersona);
    await withAction(async () => {
      const res = await acceptFriendRequest(idPersona);
      setBanner(res.message);
    });
    setFriendActionId(null);
  }

  async function handleRejectRequest(idPersona: number) {
    setFriendActionId(idPersona);
    await withAction(async () => {
      const res = await rejectFriendRequest(idPersona);
      setBanner(res.message);
    });
    setFriendActionId(null);
  }

  async function handleCancelSentRequest(idPersona: number) {
    setFriendActionId(idPersona);
    await withAction(async () => {
      const res = await cancelSentFriendRequest(idPersona);
      setBanner(res.message);
    });
    setFriendActionId(null);
  }

  async function handleConfirmBlock() {
    if (!blockingTarget) return;

    const idPersona = blockingTarget.id;
    setFriendActionId(idPersona);
    await withAction(async () => {
      const res = await blockFriendUser(idPersona);
      setBanner(res.message);
      setBlockingTarget(null);
    });
    setFriendActionId(null);
  }

  async function handleAcceptInvite(idGruppo: number) {
    setInviteActionId(idGruppo);
    await withAction(async () => {
      const res = await acceptGroupInvite(idGruppo);
      setBanner(res.message);
    });
    setInviteActionId(null);
  }

  async function handleRejectInvite(idGruppo: number) {
    setInviteActionId(idGruppo);
    await withAction(async () => {
      const res = await rejectGroupInvite(idGruppo);
      setBanner(res.message);
    });
    setInviteActionId(null);
  }

  async function handleCancelSentGroupInvite(idGruppo: number, idPersona: number) {
    const actionKey = `${idGruppo}-${idPersona}`;
    setSentGroupInviteActionKey(actionKey);
    await withAction(async () => {
      const res = await cancelSentGroupInvite(idGruppo, idPersona);
      setBanner(res.message);
    });
    setSentGroupInviteActionKey(null);
  }

  return (
    <section ref={socialContainerRef} className="social-glow-scope mx-auto w-full max-w-7xl space-y-8 px-6 py-8 text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          aria-label="Torna alla home"
          className="inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Social Hub</span>
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
        </div>

        <div className="w-12" />
      </div>

      <div className="relative rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-3xl">
            <div className="absolute inset-0 rounded-xl bg-violet-500/15 blur-xl" />
            <div className="relative flex items-center rounded-xl border border-violet-500/25 bg-[#0f0f14] p-1">
              <span className="material-symbols-outlined ml-3 text-slate-500">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search traders or groups..."
                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="inline-flex space-x-1 rounded-lg border border-violet-500/20 bg-[#0d0d14] p-1">
                {([
                  ['users', 'Users'],
                  ['groups', 'Groups'],
                ] as Array<[SearchMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={`${searchMode === mode ? '' : 'text-slate-300 hover:text-slate-100'} relative rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-300`}
                  >
                    {searchMode === mode ? (
                      <motion.span
                        layoutId="social-search-toggle"
                        className="absolute inset-0 z-10 rounded-md bg-violet-500 shadow-lg shadow-violet-500/30"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
                      />
                    ) : null}
                    <span className="relative z-20">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <button
              ref={requestsButtonRef}
              onClick={() => {
                setRequestsOpen((prev) => !prev);
                setInvitesOpen(false);
              }}
              className="relative flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition-all duration-300 hover:bg-violet-500/20"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              Requests
              {requestBadgeCount > 0 && !requestsOpen ? (
                <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-black text-white">{requestBadgeCount}</span>
              ) : null}
            </button>

            <button
              ref={invitesButtonRef}
              onClick={() => {
                setInvitesOpen((prev) => !prev);
                setRequestsOpen(false);
              }}
              className="relative flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition-all duration-300 hover:bg-violet-500/20"
            >
              <span className="material-symbols-outlined text-lg">group_add</span>
              Invites
              {invitesBadgeCount > 0 && !invitesOpen ? (
                <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-black text-white">{invitesBadgeCount}</span>
              ) : null}
            </button>

            <AnimatePresence>
              {requestsOpen ? (
                <motion.div
                  ref={requestsPanelRef}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="social-glow-card social-overlay-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] rounded-2xl border border-violet-500/30 bg-[#0f0f14] p-4 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">Friend Requests</p>
                    <button
                      onClick={() => setRequestsOpen(false)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20"
                      aria-label="Chiudi richieste"
                    >
                      <span className="text-xs font-black leading-none">x</span>
                    </button>
                  </div>
                  <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Received</p>
                      {incomingRequests.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">Nessuna richiesta ricevuta.</p>
                      ) : (
                        incomingRequests.map((req) => (
                          <div key={`incoming-${req.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                                {req.photo_url ? <img src={req.photo_url} alt={req.username} className="h-full w-full object-cover" /> : avatarFallback(req.username)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-100">{req.username}</p>
                                <p className="text-[11px] text-slate-400">Vuole collegarsi con te.</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleAcceptRequest(req.id_persona)}
                                disabled={friendActionId === req.id_persona}
                                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200 transition-all duration-300 hover:bg-emerald-500/30 disabled:opacity-70"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => void handleRejectRequest(req.id_persona)}
                                disabled={friendActionId === req.id_persona}
                                className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-200 transition-all duration-300 hover:bg-amber-500/30 disabled:opacity-70"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => setBlockingTarget({ id: req.id_persona, username: req.username })}
                                disabled={friendActionId === req.id_persona}
                                className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-200 transition-all duration-300 hover:bg-rose-500/30 disabled:opacity-70"
                              >
                                Block
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/90">Sent</p>
                      {outgoingRequests.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">Nessuna richiesta inviata pendente.</p>
                      ) : (
                        outgoingRequests.map((req) => (
                          <div key={`outgoing-${req.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                                  {req.photo_url ? <img src={req.photo_url} alt={req.username} className="h-full w-full object-cover" /> : avatarFallback(req.username)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-100">{req.username}</p>
                                  <p className="text-[11px] text-slate-400">In attesa di risposta.</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">Sent</span>
                                <button
                                  onClick={() => void handleCancelSentRequest(req.id_persona)}
                                  disabled={friendActionId === req.id_persona}
                                  className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200 transition-all duration-300 hover:bg-rose-500/30 disabled:opacity-70"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {invitesOpen ? (
                <motion.div
                  ref={invitesPanelRef}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="social-glow-card social-overlay-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] rounded-2xl border border-violet-500/30 bg-[#0f0f14] p-4 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">Group Invites</p>
                    <button
                      onClick={() => setInvitesOpen(false)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20"
                      aria-label="Chiudi inviti"
                    >
                      <span className="text-xs font-black leading-none">x</span>
                    </button>
                  </div>
                  <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Received</p>
                      {groupInvites.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">Nessun invito gruppo pendente.</p>
                      ) : (
                        groupInvites.map((invite) => (
                          <div key={`recv-${invite.id_gruppo}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-100">{invite.gruppo.nome}</p>
                                <p className="text-[11px] text-slate-400">Invito da {invite.mittente.username}</p>
                              </div>
                              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">
                                {invite.gruppo.privacy}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleAcceptInvite(invite.id_gruppo)}
                                disabled={inviteActionId === invite.id_gruppo}
                                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200 transition-all duration-300 hover:bg-emerald-500/30 disabled:opacity-70"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => void handleRejectInvite(invite.id_gruppo)}
                                disabled={inviteActionId === invite.id_gruppo}
                                className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-200 transition-all duration-300 hover:bg-amber-500/30 disabled:opacity-70"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/90">Sent</p>
                      {sentGroupInvites.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">Nessun invito gruppo inviato pendente.</p>
                      ) : (
                        sentGroupInvites.map((invite) => (
                          <div key={`sent-${invite.id_gruppo}-${invite.invitato.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-100">{invite.gruppo.nome}</p>
                                <p className="text-[11px] text-slate-400">Inviato a {invite.invitato.username}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-200">Sent</span>
                                <button
                                  onClick={() => void handleCancelSentGroupInvite(invite.id_gruppo, invite.invitato.id_persona)}
                                  disabled={sentGroupInviteActionKey === `${invite.id_gruppo}-${invite.invitato.id_persona}`}
                                  className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200 transition-all duration-300 hover:bg-rose-500/30 disabled:opacity-70"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {searchLoading ? <p className="mt-3 text-xs text-slate-400">Ricerca in corso...</p> : null}
        {searchError ? <p className="mt-3 text-xs text-rose-400">{searchError}</p> : null}

        {searchTerm.trim() ? (
          <div className="mt-4 rounded-2xl border border-[#1f1f2e] bg-[#0f0f14] p-4">
            {searchMode === 'users' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {peopleResults.length === 0 ? (
                  <p className="text-sm text-slate-400">Nessun utente trovato.</p>
                ) : (
                  peopleResults.map((person) => {
                    const relation = userRelation(person.id_persona);
                    return (
                      <div key={person.id_persona} className="flex items-center justify-between rounded-xl border border-[#232337] bg-[#13131a] p-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                            {person.photo_url ? <img src={person.photo_url} alt={person.username} className="h-full w-full object-cover" /> : avatarFallback(person.username)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-100">{person.username}</p>
                            <p className="text-[11px] text-slate-400">
                              {relation === 'friend' ? 'Gia tuo amico' : relation === 'outgoing' ? 'Richiesta gia inviata' : relation === 'incoming' ? 'Richiesta ricevuta' : relation === 'self' ? 'Questo sei tu' : 'Non ancora amico'}
                            </p>
                          </div>
                        </div>
                        {relation === 'none' ? (
                          <button
                            onClick={() => void handleSendRequest(person.id_persona)}
                            disabled={friendActionId === person.id_persona}
                            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-violet-200 transition-all duration-300 hover:bg-violet-500/20 disabled:opacity-70"
                          >
                            Add Friend
                          </button>
                        ) : (
                          <span className="rounded-full border border-[#2a2a39] bg-[#11111a] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                            {relation === 'friend' ? 'Friend' : relation === 'incoming' ? 'Pending' : relation === 'outgoing' ? 'Sent' : 'You'}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {groupResults.length === 0 ? (
                  <p className="text-sm text-slate-400">Nessun gruppo trovato.</p>
                ) : (
                  groupResults.map((group) => (
                    <button
                      key={group.id_gruppo}
                      onClick={() => navigate(`/groups/${group.id_gruppo}`)}
                      className="flex items-center justify-between rounded-xl border border-[#232337] bg-[#13131a] p-3 text-left transition-all duration-300 hover:border-violet-500/35 hover:bg-[#171724]"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-100">{group.nome}</p>
                        <p className="text-[11px] text-slate-400">{group.privacy} group</p>
                      </div>
                      <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                        {group.is_member ? 'Member' : 'Not member'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        {banner || loadingError ? (
          <motion.div
            key="social-banner"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`fixed bottom-4 right-4 z-[120] w-[min(520px,90vw)] rounded-xl border px-4 py-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur ${banner ? 'border-violet-500/35 bg-[#141529]/95 text-violet-100' : 'border-rose-500/35 bg-[#26131b]/95 text-rose-100'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined mt-0.5 ${banner ? 'text-violet-300' : 'text-rose-300'}`}>{banner ? 'check_circle' : 'error'}</span>
              <p className="flex-1">{banner ?? loadingError}</p>
              <button
                onClick={() => {
                  setBanner(null);
                  setLoadingError(null);
                }}
                className="grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-white/10"
                aria-label="Chiudi notifica"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loading ? <p className="text-sm text-slate-400">Caricamento area social...</p> : null}

      {!loading ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Connections <span className="text-sm font-normal text-slate-500">({friends.length})</span></h2>
            </div>
            <div className="space-y-3">
              {friends.length === 0 ? (
                <p className="rounded-xl border border-[#1f1f2e] bg-[#13131a] px-4 py-5 text-sm text-slate-400">Non hai ancora amici accettati.</p>
              ) : (
                friends.map((friend) => (
                  <article key={friend.id_persona} className="social-glow-card group flex items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4 transition-all duration-300 hover:border-violet-500/30">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                        {friend.photo_url ? <img src={friend.photo_url} alt={friend.username} className="h-full w-full object-cover" /> : avatarFallback(friend.username)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100">{friend.username}</h3>
                        <p className="text-[11px] uppercase tracking-wide text-emerald-300">Friend connected</p>
                      </div>
                    </div>
                    <button className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-violet-200 transition-all duration-300 hover:bg-violet-500/20">
                      Message
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Trading Squads <span className="text-sm font-normal text-slate-500">({myGroups.length})</span></h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {myGroups.length === 0 ? (
                <p className="md:col-span-2 rounded-xl border border-[#1f1f2e] bg-[#13131a] px-4 py-5 text-sm text-slate-400">Non fai ancora parte di gruppi.</p>
              ) : (
                myGroups.map((group) => (
                  <button
                    key={group.id_gruppo}
                    onClick={() => navigate(`/groups/${group.id_gruppo}`)}
                    className="social-glow-card rounded-2xl border border-violet-500/20 bg-[#13131a] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/35 hover:bg-[#191927]"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">{group.nome}</h3>
                        <p className="text-xs text-slate-400">{group.privacy} group</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${roleChipColor(group.ruolo)}`}>
                        {group.ruolo}
                      </span>
                    </div>
                    <div className="space-y-1 border-t border-[#232337] pt-3">
                      <p className="text-xs text-slate-400">{group.descrizione || 'Nessuna descrizione'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Budget iniziale gruppo</span>
                        <span className="text-xs font-semibold text-violet-300">${Number(group.budget_iniziale ?? '0').toFixed(2)}</span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-300/90">
                        Open Group
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </div>
                    </div>
                  </button>
                ))
              )}

              <article className="social-glow-card flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-500/35 bg-violet-500/5 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10">
                  <span className="material-symbols-outlined text-violet-300">add_circle</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-100">Create Squad</h3>
                <p className="mt-1 text-xs text-slate-400">Configura gruppo, privacy, budget e inviti in un unico flusso.</p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600"
                >
                  Create Group
                </button>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      <AnimatePresence>
        {createModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-violet-400/35 bg-[#111118] shadow-2xl shadow-violet-900/30"
            >
              <div className="max-h-[88vh] overflow-y-auto p-6">
                <div className="mb-6 flex items-center justify-between">
                  <button
                    onClick={() => setCreateModalOpen(false)}
                    aria-label="Torna indietro"
                    className="inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
                  >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                  </button>

                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => photoUrlInputRef.current?.focus()}
                      className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-violet-500/40 bg-[#1a1a27] text-violet-200 transition-all duration-300 hover:border-violet-400"
                    >
                      {createForm.photoUrl.trim() ? (
                        <img src={createForm.photoUrl} alt="Group" className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-3xl">groups</span>
                      )}
                      <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border border-violet-300/60 bg-violet-500 text-white shadow-lg shadow-violet-500/30">
                        <span className="material-symbols-outlined text-base">add</span>
                      </span>
                    </button>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-violet-300/85">Create New Group</p>
                  </div>

                  <div className="w-[76px]" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Group Name</label>
                    <input
                      value={createForm.nome}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, nome: e.target.value }))}
                      placeholder="Inserisci nome gruppo"
                      className="h-11 w-full rounded-xl border border-[#2a2a39] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Photo URL (optional)</label>
                    <input
                      ref={photoUrlInputRef}
                      value={createForm.photoUrl}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
                      placeholder="https://example.com/group.jpg"
                      className="h-11 w-full rounded-xl border border-[#2a2a39] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Privacy</label>
                    <div className="inline-flex space-x-1 rounded-lg border border-violet-500/20 bg-[#0d0d14] p-1">
                      {([
                        ['Private', 'Private'],
                        ['Public', 'Public'],
                      ] as Array<[GroupPrivacy, string]>).map(([privacyKey, label]) => (
                        <button
                          key={privacyKey}
                          onClick={() => setCreateForm((prev) => ({ ...prev, privacy: privacyKey }))}
                          className={`${createForm.privacy === privacyKey ? '' : 'text-slate-300 hover:text-slate-100'} relative rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-300`}
                        >
                          {createForm.privacy === privacyKey ? (
                            <motion.span
                              layoutId="group-create-privacy"
                              className="absolute inset-0 z-10 rounded-md bg-violet-500 shadow-lg shadow-violet-500/30"
                              transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
                            />
                          ) : null}
                          <span className="relative z-20">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Initial Budget</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.budgetIniziale}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, budgetIniziale: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#2a2a39] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Description (optional)</label>
                    <textarea
                      value={createForm.descrizione}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, descrizione: e.target.value }))}
                      placeholder="Descrivi il gruppo..."
                      rows={3}
                      className="w-full rounded-xl border border-[#2a2a39] bg-[#13131a] px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-violet-500/20 bg-[#0f0f14] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Invite people</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedInvitees.length === 0 ? (
                      <span className="text-xs text-slate-500">Nessun invitato selezionato.</span>
                    ) : (
                      selectedInvitees.map((person) => (
                        <span key={person.id_persona} className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                          {person.username}
                          <button
                            onClick={() => toggleInvitee(person)}
                            className="grid h-4 w-4 place-items-center rounded-full bg-violet-500/30 text-[10px] leading-none text-white hover:bg-violet-500/45"
                            aria-label="Remove invitee"
                          >
                            x
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <input
                    value={inviteSearchTerm}
                    onChange={(e) => setInviteSearchTerm(e.target.value)}
                    placeholder="Cerca persona per nickname..."
                    className="mt-3 h-10 w-full rounded-lg border border-[#2a2a39] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                  />

                  {inviteSearchLoading ? <p className="mt-2 text-xs text-slate-400">Ricerca utenti in corso...</p> : null}
                  {inviteSearchTerm.trim() && inviteSearchResults.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Nessun match globale: sotto trovi i tuoi amici come fallback.</p>
                  ) : null}

                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {inviteCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500">Nessuna persona disponibile per l'invito.</p>
                    ) : (
                      inviteCandidates.map((person) => {
                        const isSelf = person.id_persona === user?.id_persona;
                        const isAlreadyInvited = selectedInviteeIds.includes(person.id_persona);
                        const disabled = isSelf || isAlreadyInvited;

                        return (
                          <button
                            key={person.id_persona}
                            onClick={() => {
                              if (disabled) return;
                              toggleInvitee(person);
                            }}
                            disabled={disabled}
                            className="flex w-full items-center justify-between rounded-lg border border-[#232337] bg-[#13131a] px-3 py-2 text-left transition-all duration-300 hover:border-violet-500/35 hover:bg-[#171724] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-[11px] font-black text-violet-200">
                                {person.photo_url ? <img src={person.photo_url} alt={person.username} className="h-full w-full object-cover" /> : avatarFallback(person.username)}
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-slate-100">{person.username}</span>
                                <div className="mt-0.5 flex items-center gap-1">
                                  {person.source === 'friends' || person.is_friend ? (
                                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200">Friend</span>
                                  ) : null}
                                  {person.source === 'search' ? (
                                    <span className="rounded-full border border-slate-400/25 bg-slate-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-300">Search</span>
                                  ) : null}
                                  {isSelf ? (
                                    <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">Già nel gruppo</span>
                                  ) : null}
                                  {isAlreadyInvited ? (
                                    <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-200">Già invitato</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-violet-300">{disabled ? 'Locked' : 'Add'}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {createError ? (
                  <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {createError}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => setCreateModalOpen(false)}
                    disabled={creatingGroup}
                    className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => void handleCreateGroup()}
                    disabled={creatingGroup}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                  >
                    {creatingGroup ? 'Creazione in corso...' : 'Create Group'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {accountModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="w-full max-w-4xl overflow-hidden rounded-2xl border border-violet-400/35 bg-[#111118] shadow-2xl shadow-violet-900/30"
            >
              <div className="max-h-[88vh] overflow-y-auto p-6">
                <div className="mb-5 flex items-center justify-between">
                  <button
                    onClick={() => closeAccountModal()}
                    aria-label="Torna indietro"
                    className="inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
                  >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                  </button>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">My Account</p>
                  <div className="w-[72px]" />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-[#2a2a39] bg-[#13131a] p-4">
                    <button
                      onClick={() => accountPhotoUrlInputRef.current?.focus()}
                      className="relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-violet-500/40 bg-[#1a1a27] text-violet-200"
                    >
                      {accountForm.photoUrl.trim() ? (
                        <img src={accountForm.photoUrl} alt={accountForm.username || 'User'} className="h-full w-full object-cover" />
                      ) : user?.photo_url ? (
                        <img src={user.photo_url} alt={user.username} className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-4xl">person</span>
                      )}
                      <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border border-violet-300/60 bg-violet-500 text-white shadow-lg shadow-violet-500/30">
                        <span className="material-symbols-outlined text-base">add</span>
                      </span>
                    </button>
                    <h3 className="mt-3 text-center text-lg font-bold text-slate-100">{user?.username}</h3>
                    <p className="mt-1 text-center text-xs text-slate-400">Gestisci credenziali, foto e sicurezza account.</p>
                    <div className="mt-4 space-y-2 border-t border-[#232337] pt-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Friends</span>
                        <span className="font-bold text-violet-200">{friends.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Groups</span>
                        <span className="font-bold text-violet-200">{myGroups.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pending invites</span>
                        <span className="font-bold text-violet-200">{groupInvites.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="rounded-2xl border border-[#2a2a39] bg-[#13131a] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Public profile</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Username</label>
                          <input
                            value={accountForm.username}
                            onChange={(e) => setAccountForm((prev) => ({ ...prev, username: e.target.value }))}
                            className="h-10 w-full rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                          />
                          <button
                            onClick={() => void handleUpdateUsername()}
                            disabled={accountBusyAction !== null}
                            className="rounded-lg bg-violet-500 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                          >
                            {accountBusyAction === 'username' ? 'Updating...' : 'Update username'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</label>
                          <input
                            value={accountForm.email}
                            onChange={(e) => setAccountForm((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="name@email.com"
                            className="h-10 w-full rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                          />
                          <button
                            onClick={() => void handleUpdateEmail()}
                            disabled={accountBusyAction !== null}
                            className="rounded-lg bg-sky-500/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-sky-500 disabled:opacity-70"
                          >
                            {accountBusyAction === 'email' ? 'Updating...' : 'Update email'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Photo URL</label>
                          <input
                            ref={accountPhotoUrlInputRef}
                            value={accountForm.photoUrl}
                            onChange={(e) => setAccountForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
                            placeholder="https://example.com/avatar.jpg"
                            className="h-10 w-full rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                          />
                          <button
                            onClick={() => void handleUpdatePhoto()}
                            disabled={accountBusyAction !== null}
                            className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-violet-200 transition-all duration-300 hover:bg-violet-500/20 disabled:opacity-70"
                          >
                            {accountBusyAction === 'photo' ? 'Saving...' : 'Update photo'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#2a2a39] bg-[#13131a] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Security</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <input
                          type="password"
                          value={accountForm.oldPassword}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                          placeholder="Current password"
                          className="h-10 rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                        <input
                          type="password"
                          value={accountForm.newPassword}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="New password"
                          className="h-10 rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                        <input
                          type="password"
                          value={accountForm.confirmNewPassword}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className="h-10 rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                      <button
                        onClick={() => void handleUpdatePassword()}
                        disabled={accountBusyAction !== null}
                        className="mt-3 rounded-lg bg-emerald-500/85 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-emerald-500 disabled:opacity-70"
                      >
                        {accountBusyAction === 'password' ? 'Updating...' : 'Change password'}
                      </button>
                    </div>

                    {accountError ? (
                      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                        {accountError}
                      </div>
                    ) : null}
                    {accountSuccess ? (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                        {accountSuccess}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {blockingTarget ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="w-full max-w-md rounded-2xl border border-rose-400/35 bg-[#111118] p-5 shadow-2xl shadow-rose-900/25"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-300/85">Conferma blocco utente</p>
              <p className="mt-3 text-sm text-slate-200">
                Vuoi bloccare <span className="font-bold text-rose-200">{blockingTarget.username}</span>? L'utente non potra interagire con te.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleConfirmBlock()}
                  disabled={friendActionId === blockingTarget.id}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-rose-600 disabled:opacity-70"
                >
                  {friendActionId === blockingTarget.id ? 'Blocco in corso...' : 'Conferma blocco'}
                </button>
                <button
                  onClick={() => setBlockingTarget(null)}
                  disabled={friendActionId === blockingTarget.id}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
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
