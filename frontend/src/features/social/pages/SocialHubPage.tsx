import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { useLocation, useNavigate } from 'react-router-dom';
import Cropper, { Area } from 'react-easy-crop';
import { useAuth } from '../../auth/context/AuthContext';
import {
  changeMyEmail,
  changeMyPassword,
  changeMyUsername,
  deleteUserAccount,
  setAccessToken,
  uploadMyPhoto,
  removeMyPhoto,
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
import { getGroupRanking, updateGroupPhoto } from '../../groups/api/groupDetailApi';
import { resolveUserPhotoUrl } from '../../../shared/utils/cloudinary';
import { getCircularCroppedImageFile } from '../../../shared/utils/imageCrop';

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
  descrizione: string;
  budgetIniziale: string;
}

interface AccountForm {
  username: string;
  email: string;
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

function toCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value)}`;
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
  const { user, refreshProfile, logout } = useAuth();
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
  const [groupRankingPreviewById, setGroupRankingPreviewById] = useState<Record<number, Array<{ username: string; value: string; photo_url?: string | null }>>>({});

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
    descrizione: '',
    budgetIniziale: '0',
  });
  const [groupCropOpen, setGroupCropOpen] = useState(false);
  const [selectedGroupPhotoSrc, setSelectedGroupPhotoSrc] = useState<string | null>(null);
  const [selectedGroupPhotoName, setSelectedGroupPhotoName] = useState('group-photo.jpg');
  const [groupCrop, setGroupCrop] = useState({ x: 0, y: 0 });
  const [groupZoom, setGroupZoom] = useState(1);
  const [groupCroppedAreaPixels, setGroupCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedGroupPhotoFile, setCroppedGroupPhotoFile] = useState<File | null>(null);
  const [croppedGroupPhotoPreviewDataUrl, setCroppedGroupPhotoPreviewDataUrl] = useState<string | null>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountBusyAction, setAccountBusyAction] = useState<'username' | 'email' | 'photo' | 'password' | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [showAccountPasswords, setShowAccountPasswords] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState('');
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>({
    username: '',
    email: '',
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [profileCropOpen, setProfileCropOpen] = useState(false);
  const [selectedProfilePhotoSrc, setSelectedProfilePhotoSrc] = useState<string | null>(null);
  const [profileCrop, setProfileCrop] = useState({ x: 0, y: 0 });
  const [profileZoom, setProfileZoom] = useState(1);
  const [profileCroppedAreaPixels, setProfileCroppedAreaPixels] = useState<Area | null>(null);
  const [selectedProfilePhotoName, setSelectedProfilePhotoName] = useState('profile-photo.jpg');

  const createGroupPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const socialContainerRef = useRef<HTMLElement | null>(null);
  const requestsButtonRef = useRef<HTMLButtonElement | null>(null);
  const invitesButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestsPanelRef = useRef<HTMLDivElement | null>(null);
  const invitesPanelRef = useRef<HTMLDivElement | null>(null);
  const userAvatar96 = resolveUserPhotoUrl(user?.photo_url, 96);
  const rankingAvatarRefreshKey = useMemo(() => Date.now(), [groupRankingPreviewById]);
  const searchAvatarRefreshKey = useMemo(() => Date.now(), [peopleResults, inviteSearchResults]);

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
        setLoadingError(err instanceof Error ? err.message : 'Unable to load social section.');
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
        setSearchError(err instanceof Error ? err.message : 'Search failed.');
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
    if (myGroups.length === 0) {
      setGroupRankingPreviewById({});
      return;
    }

    let active = true;

    void (async () => {
      const results = await Promise.allSettled(
        myGroups.map(async (group) => {
          const ranking = await getGroupRanking(group.id_gruppo);
          return {
            id: group.id_gruppo,
            top: ranking.ranking.slice(0, 4).map((row) => ({
              username: row.username,
              value: toCompactCurrency(Number(row.valore_totale)),
              photo_url: row.photo_url,
            })),
          };
        }),
      );

      if (!active) return;

      const next: Record<number, Array<{ username: string; value: string; photo_url?: string | null }>> = {};
      for (const row of results) {
        if (row.status === 'fulfilled') {
          next[row.value.id] = row.value.top;
        }
      }
      setGroupRankingPreviewById(next);
    })();

    return () => {
      active = false;
    };
  }, [myGroups]);

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
    if (!blockingTarget && !createModalOpen && !accountModalOpen && !deleteConfirmationOpen && !profileCropOpen && !groupCropOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [blockingTarget, createModalOpen, accountModalOpen, deleteConfirmationOpen, profileCropOpen, groupCropOpen]);

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
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setDeleteUsernameInput('');
      setDeletePhraseInput('');
      setDeleteAcknowledge(false);
      setDeleteConfirmationOpen(false);
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
    setDeleteConfirmationOpen(false);
    setDeleteUsernameInput('');
    setDeletePhraseInput('');
    setDeleteAcknowledge(false);
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
      setLoadingError(err instanceof Error ? err.message : 'Operation failed.');
    }
  }

  function openCreateModal() {
    setCreateError(null);
    setInviteSearchTerm('');
    setInviteSearchResults([]);
    setSelectedInvitees([]);
    setGroupCropOpen(false);
    setSelectedGroupPhotoSrc(null);
    setSelectedGroupPhotoName('group-photo.jpg');
    setGroupCrop({ x: 0, y: 0 });
    setGroupZoom(0.85);
    setGroupCroppedAreaPixels(null);
    setCroppedGroupPhotoFile(null);
    setCroppedGroupPhotoPreviewDataUrl(null);
    setCreateForm({
      nome: '',
      privacy: 'Private',
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
      setCreateError('Group name must be at least 3 characters long.');
      return;
    }

    const budget = parseBudget(createForm.budgetIniziale);

    setCreatingGroup(true);
    setCreateError(null);

    try {
      const created = await createGroup({
        nome: groupName,
        privacy: createForm.privacy,
        descrizione: createForm.descrizione.trim() || undefined,
        budget_iniziale: budget.toFixed(2),
      });

      const groupId = created.group.id_gruppo;

      if (croppedGroupPhotoFile) {
        try {
          await updateGroupPhoto(groupId, croppedGroupPhotoFile);
        } catch {
          setBanner('Group created, but photo upload failed. You can retry from group settings.');
        }
      }

      if (selectedInvitees.length > 0) {
        const inviteResults = await Promise.allSettled(
          selectedInvitees.map((person) => invitePersonToGroup(groupId, person.id_persona)),
        );

        const failedInvites = inviteResults.filter((result) => result.status === 'rejected').length;
        if (failedInvites > 0) {
          setBanner(`Group created, but ${failedInvites} invites could not be sent.`);
        }
      }

      await refreshData();
      setCreateModalOpen(false);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create group.');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleSelectCreateGroupPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;

    const isSupportedType = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isSupportedType) {
      setCreateError('Only JPEG and PNG images are allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setCreateError('Group image must be 2MB or smaller.');
      return;
    }

    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Unable to read selected image.'));
        };
        reader.onerror = () => reject(new Error('Unable to read selected image.'));
        reader.readAsDataURL(file);
      });

      setCreateError(null);
      setSelectedGroupPhotoName(file.name || 'group-photo.jpg');
      setSelectedGroupPhotoSrc(imageDataUrl);
      setGroupCrop({ x: 0, y: 0 });
      setGroupZoom(0.85);
      setGroupCroppedAreaPixels(null);
      setGroupCropOpen(true);
    } catch {
      setCreateError('Unable to load selected image.');
    }
  }

  function closeCreateGroupCropModal() {
    setGroupCropOpen(false);
    setSelectedGroupPhotoSrc(null);
    setGroupCrop({ x: 0, y: 0 });
    setGroupZoom(0.85);
    setGroupCroppedAreaPixels(null);
  }

  async function handleSaveCreateGroupPhotoCrop() {
    if (!selectedGroupPhotoSrc || !groupCroppedAreaPixels) {
      setCreateError('Select and crop an image before saving.');
      return;
    }

    try {
      const croppedFile = await getCircularCroppedImageFile(
        selectedGroupPhotoSrc,
        groupCroppedAreaPixels,
        selectedGroupPhotoName,
      );

      const previewDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Unable to read cropped image.'));
        };
        reader.onerror = () => reject(new Error('Unable to read cropped image.'));
        reader.readAsDataURL(croppedFile);
      });

      setCroppedGroupPhotoFile(croppedFile);
      setCroppedGroupPhotoPreviewDataUrl(previewDataUrl);
      closeCreateGroupCropModal();
    } catch {
      setCreateError('Unable to crop selected image.');
    }
  }

  async function handleUpdateUsername() {
    const newUsername = accountForm.username.trim();
    if (newUsername.length < 3) {
      setAccountError('Username is too short. Minimum 3 characters.');
      return;
    }

    try {
      setAccountBusyAction('username');
      setAccountError(null);
      const response = await changeMyUsername(newUsername);
      setAccessToken(response.access_token);
      await refreshProfile();
      setAccountSuccess('Username updated successfully.');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to update username.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleSelectProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;

    const isSupportedType = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isSupportedType) {
      setAccountError('Only JPEG and PNG images are allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAccountError('Profile image must be 2MB or smaller.');
      return;
    }

    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Unable to read selected image.'));
        };
        reader.onerror = () => reject(new Error('Unable to read selected image.'));
        reader.readAsDataURL(file);
      });

      setAccountError(null);
      setAccountSuccess(null);
      setSelectedProfilePhotoName(file.name || 'profile-photo.jpg');
      setSelectedProfilePhotoSrc(imageDataUrl);
      setProfileCrop({ x: 0, y: 0 });
      setProfileZoom(0.85);
      setProfileCroppedAreaPixels(null);
      setProfileCropOpen(true);
    } catch {
      setAccountError('Unable to load selected image.');
    }
  }

  function closeProfileCropModal() {
    setSelectedProfilePhotoSrc(null);
    setProfileCropOpen(false);
    setProfileCrop({ x: 0, y: 0 });
    setProfileZoom(0.85);
    setProfileCroppedAreaPixels(null);
  }

  async function handleUploadCroppedPhoto() {
    if (!selectedProfilePhotoSrc || !profileCroppedAreaPixels) {
      setAccountError('Select and crop an image before saving.');
      return;
    }

    try {
      setAccountBusyAction('photo');
      setAccountError(null);

      const croppedFile = await getCircularCroppedImageFile(
        selectedProfilePhotoSrc,
        profileCroppedAreaPixels,
        selectedProfilePhotoName,
      );

      await uploadMyPhoto(croppedFile);
      await refreshProfile();
      closeProfileCropModal();
      setAccountSuccess('Profile photo updated successfully.');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to update profile photo.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleUpdateEmail() {
    const nextEmail = accountForm.email.trim();
    if (!nextEmail) {
      setAccountError('Please enter a valid email.');
      return;
    }

    try {
      setAccountBusyAction('email');
      setAccountError(null);
      const response = await changeMyEmail(nextEmail);
      await refreshProfile();
      setAccountSuccess(response.message);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to update email.');
    } finally {
      setAccountBusyAction(null);
    }
  }

  async function handleUpdatePassword() {
    if (accountForm.newPassword.length < 8) {
      setAccountError('New password must be at least 8 characters long.');
      return;
    }

    if (accountForm.newPassword !== accountForm.confirmNewPassword) {
      setAccountError('New passwords do not match.');
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
      const message = err instanceof Error ? err.message : 'Unable to update password.';
      if (/current password is incorrect/i.test(message)) {
        setAccountError('Current password is incorrect.');
      } else {
        setAccountError(message);
      }
    } finally {
      setAccountBusyAction(null);
    }
  }

  const isDeleteUsernameConfirmed = deleteUsernameInput.trim() === (user?.username ?? '');
  const isDeletePhraseConfirmed = deletePhraseInput.trim() === 'DELETE MY ACCOUNT';

  async function handleDeleteAccount() {
    if (!user) return;

    if (!isDeleteUsernameConfirmed || !deleteAcknowledge) {
      setAccountError('Please complete all delete confirmations before continuing.');
      return;
    }

    if (!isDeletePhraseConfirmed) {
      setAccountError('Type DELETE MY ACCOUNT to confirm permanent deletion.');
      return;
    }

    try {
      setDeletingAccount(true);
      setAccountError(null);
      const response = await deleteUserAccount(user.id_persona);
      setBanner(response.message);
      setDeleteConfirmationOpen(false);
      closeAccountModal();
      await logout();
      setAccessToken(null);
      navigate('/register', { replace: true });
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to delete account.');
    } finally {
      setDeletingAccount(false);
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
          aria-label="Back to home"
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

            {requestsOpen ? (
                <div
                  ref={requestsPanelRef}
                  className="social-glow-card social-overlay-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] rounded-2xl border border-violet-500/30 bg-[#0f0f14] p-4 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">Friend Requests</p>
                    <button
                      onClick={() => setRequestsOpen(false)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20"
                      aria-label="Close requests"
                    >
                      <span className="text-xs font-black leading-none">x</span>
                    </button>
                  </div>
                  <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Received</p>
                      {incomingRequests.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">No received requests.</p>
                      ) : (
                        incomingRequests.map((req) => (
                          <div key={`incoming-${req.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                                {resolveUserPhotoUrl(req.photo_url, 64) ? <img src={resolveUserPhotoUrl(req.photo_url, 64) ?? ''} alt={req.username} className="h-full w-full object-cover" /> : avatarFallback(req.username)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-100">{req.username}</p>
                                <p className="text-[11px] text-slate-400">Wants to connect with you.</p>
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
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">No pending sent requests.</p>
                      ) : (
                        outgoingRequests.map((req) => (
                          <div key={`outgoing-${req.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                                  {resolveUserPhotoUrl(req.photo_url, 64) ? <img src={resolveUserPhotoUrl(req.photo_url, 64) ?? ''} alt={req.username} className="h-full w-full object-cover" /> : avatarFallback(req.username)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-100">{req.username}</p>
                                  <p className="text-[11px] text-slate-400">Waiting for response.</p>
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
                </div>
              ) : null}

            {invitesOpen ? (
                <div
                  ref={invitesPanelRef}
                  className="social-glow-card social-overlay-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] rounded-2xl border border-violet-500/30 bg-[#0f0f14] p-4 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/85">Group Invites</p>
                    <button
                      onClick={() => setInvitesOpen(false)}
                      className="grid h-6 w-6 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20"
                      aria-label="Close invites"
                    >
                      <span className="text-xs font-black leading-none">x</span>
                    </button>
                  </div>
                  <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Received</p>
                      {groupInvites.length === 0 ? (
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">No pending group invites.</p>
                      ) : (
                        groupInvites.map((invite) => (
                          <div key={`recv-${invite.id_gruppo}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-100">{invite.gruppo.nome}</p>
                                <p className="text-[11px] text-slate-400">Invite from {invite.mittente.username}</p>
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
                        <p className="rounded-xl border border-[#232337] bg-[#13131a] px-3 py-2 text-xs text-slate-400">No pending sent group invites.</p>
                      ) : (
                        sentGroupInvites.map((invite) => (
                          <div key={`sent-${invite.id_gruppo}-${invite.invitato.id_persona}`} className="rounded-xl border border-[#232337] bg-[#13131a] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-100">{invite.gruppo.nome}</p>
                                <p className="text-[11px] text-slate-400">Sent to {invite.invitato.username}</p>
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
                </div>
              ) : null}
          </div>
        </div>

        {searchLoading ? <p className="mt-3 text-xs text-slate-400">Searching...</p> : null}
        {searchError ? <p className="mt-3 text-xs text-rose-400">{searchError}</p> : null}

        {searchTerm.trim() ? (
          <div className="mt-4 rounded-2xl border border-[#1f1f2e] bg-[#0f0f14] p-4">
            {searchMode === 'users' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {peopleResults.length === 0 ? (
                  <p className="text-sm text-slate-400">No users found.</p>
                ) : (
                  peopleResults.map((person) => {
                    const relation = userRelation(person.id_persona);
                    const personAvatar = resolveUserPhotoUrl(person.photo_url, 64);
                    return (
                      <div key={person.id_persona} className="flex items-center justify-between rounded-xl border border-[#232337] bg-[#13131a] p-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                            {personAvatar ? <img src={`${personAvatar}${personAvatar.includes('?') ? '&' : '?'}rk=${searchAvatarRefreshKey}`} alt={person.username} className="h-full w-full object-cover" /> : avatarFallback(person.username)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-100">{person.username}</p>
                            <p className="text-[11px] text-slate-400">
                              {relation === 'friend' ? 'Already your friend' : relation === 'outgoing' ? 'Request already sent' : relation === 'incoming' ? 'Request received' : relation === 'self' ? 'This is you' : 'Not a friend yet'}
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
                  <p className="text-sm text-slate-400">No groups found.</p>
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
                aria-label="Close notification"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loading ? <p className="text-sm text-slate-400">Loading social area...</p> : null}

      {!loading ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Connections <span className="text-sm font-normal text-slate-500">({friends.length})</span></h2>
            </div>
            <div className="space-y-3">
              {friends.length === 0 ? (
                <p className="rounded-xl border border-[#1f1f2e] bg-[#13131a] px-4 py-5 text-sm text-slate-400">You do not have accepted friends yet.</p>
              ) : (
                friends.map((friend) => (
                  <article key={friend.id_persona} className="social-glow-card group flex items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4 transition-all duration-300 hover:border-violet-500/30">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-xs font-black text-violet-200">
                        {resolveUserPhotoUrl(friend.photo_url, 64) ? <img src={resolveUserPhotoUrl(friend.photo_url, 64) ?? ''} alt={friend.username} className="h-full w-full object-cover" /> : avatarFallback(friend.username)}
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
                <p className="md:col-span-2 rounded-xl border border-[#1f1f2e] bg-[#13131a] px-4 py-5 text-sm text-slate-400">You are not part of any groups yet.</p>
              ) : (
                myGroups.map((group) => (
                  <button
                    key={group.id_gruppo}
                    onClick={() => navigate(`/groups/${group.id_gruppo}`)}
                    className="social-glow-card neo-card group relative flex min-h-[230px] flex-col gap-5 rounded-2xl border border-violet-500/20 bg-[#13131a] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-signal/40"
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-signal/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-signal">My Group</span>
                        <h3 className="truncate text-xl font-bold transition-colors group-hover:text-signal">{group.nome}</h3>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${group.privacy === 'Public' ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200' : 'border-violet-400/35 bg-violet-500/10 text-violet-200'}`}>
                        {group.privacy}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-canvas/45">Top 4 Ranking</p>
                      <div className="space-y-1.5">
                        {(groupRankingPreviewById[group.id_gruppo] ?? []).slice(0, 4).map((row, index) => (
                          <div key={`${group.id_gruppo}-${row.username}-${index}`} className="flex items-center justify-between text-sm text-canvas/80">
                            <span className="inline-flex items-center gap-2 truncate">
                              <span className="text-[10px] font-black text-canvas/45">{String(index + 1).padStart(2, '0')}</span>
                              <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border border-violet-500/25 bg-[#1a1a27] text-[9px] font-black text-violet-200">
                                {resolveUserPhotoUrl(row.photo_url ?? null, 48) ? (
                                  <img
                                    src={`${resolveUserPhotoUrl(row.photo_url ?? null, 48)}${resolveUserPhotoUrl(row.photo_url ?? null, 48)?.includes('?') ? '&' : '?'}rk=${rankingAvatarRefreshKey}`}
                                    alt={row.username}
                                    className="h-full w-full object-cover"
                                  />
                                ) : avatarFallback(row.username)}
                              </span>
                              <span className="truncate">{row.username}</span>
                            </span>
                            <span className="text-xs font-bold text-emerald-300">{row.value}</span>
                          </div>
                        ))}
                        {(groupRankingPreviewById[group.id_gruppo] ?? []).length === 0 ? (
                          <p className="text-xs text-canvas/45">Ranking preview unavailable.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-canvas/10 pt-4">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${roleChipColor(group.ruolo)}`}>
                        {group.ruolo}
                      </span>
                      <span className="rounded-lg bg-signal px-4 py-2 text-xs font-bold uppercase text-obsidian transition-all duration-300 group-hover:bg-signal/85">
                        Open Group
                      </span>
                    </div>
                  </button>
                ))
              )}

              <button
                type="button"
                onClick={openCreateModal}
                className="social-glow-card group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-violet-500/35 bg-violet-500/5 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:bg-violet-500/10"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10">
                  <span className="material-symbols-outlined text-violet-300 transition-transform duration-300 group-hover:scale-105">add_circle</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-100">Create Squad</h3>
                <p className="mt-1 text-xs text-slate-400">Set up group, privacy, budget, and invites in one flow.</p>
                <span className="mt-4 rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 group-hover:bg-violet-600">
                  Create Group
                </span>
              </button>
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
                    aria-label="Go back"
                    className="inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
                  >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                  </button>

                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => createGroupPhotoInputRef.current?.click()}
                      className="relative grid h-20 w-20 place-items-center rounded-full border-2 border-violet-500/40 bg-[#1a1a27] text-violet-200 transition-all duration-300 hover:border-violet-400"
                    >
                      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
                        {croppedGroupPhotoPreviewDataUrl ? (
                          <img src={croppedGroupPhotoPreviewDataUrl} alt="Group" className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-3xl">groups</span>
                        )}
                      </span>
                      <span className="absolute -top-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-violet-200/70 bg-violet-500 text-white shadow-lg shadow-violet-500/40">
                        <span className="material-symbols-outlined text-base">{croppedGroupPhotoPreviewDataUrl ? 'autorenew' : 'add'}</span>
                      </span>
                    </button>
                    <input
                      ref={createGroupPhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleSelectCreateGroupPhoto}
                      className="hidden"
                    />
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
                      placeholder="Enter group name"
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
                      placeholder="Describe the group..."
                      rows={3}
                      className="w-full rounded-xl border border-[#2a2a39] bg-[#13131a] px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-violet-500/20 bg-[#0f0f14] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Invite people</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedInvitees.length === 0 ? (
                      <span className="text-xs text-slate-500">No invitees selected.</span>
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
                    placeholder="Search people by username..."
                    className="mt-3 h-10 w-full rounded-lg border border-[#2a2a39] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                  />

                  {inviteSearchLoading ? <p className="mt-2 text-xs text-slate-400">Searching users...</p> : null}
                  {inviteSearchTerm.trim() && inviteSearchResults.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No global matches: your friends are shown below as fallback.</p>
                  ) : null}

                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {inviteCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500">No people available for invitation.</p>
                    ) : (
                      inviteCandidates.map((person) => {
                        const isSelf = person.id_persona === user?.id_persona;
                        const isAlreadyInvited = selectedInviteeIds.includes(person.id_persona);
                        const disabled = isSelf || isAlreadyInvited;
                        const personAvatar = resolveUserPhotoUrl(person.photo_url, 64);

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
                                {personAvatar ? <img src={`${personAvatar}${personAvatar.includes('?') ? '&' : '?'}rk=${searchAvatarRefreshKey}`} alt={person.username} className="h-full w-full object-cover" /> : avatarFallback(person.username)}
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
                                    <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">Already in group</span>
                                  ) : null}
                                  {isAlreadyInvited ? (
                                    <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-200">Already invited</span>
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
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleCreateGroup()}
                    disabled={creatingGroup}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                  >
                    {creatingGroup ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {groupCropOpen && selectedGroupPhotoSrc ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              className="w-full max-w-xl rounded-2xl border border-violet-400/35 bg-[#111118] p-5 shadow-2xl shadow-violet-900/25"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Edit group photo</p>
              <p className="mt-2 text-sm text-slate-300">Drag and zoom to align the group image inside the circular frame.</p>

              <div className="relative mt-4 h-[320px] overflow-hidden rounded-2xl border border-[#2a2a39] bg-[#0f0f14]">
                <Cropper
                  image={selectedGroupPhotoSrc}
                  crop={groupCrop}
                  zoom={groupZoom}
                  minZoom={0.35}
                  maxZoom={4}
                  restrictPosition={false}
                  objectFit="contain"
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setGroupCrop}
                  onZoomChange={setGroupZoom}
                  onCropComplete={(_, croppedAreaPixels) => setGroupCroppedAreaPixels(croppedAreaPixels)}
                />
              </div>

              <div className="mt-4">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Zoom</label>
                <input
                  type="range"
                  min={0.35}
                  max={4}
                  step={0.01}
                  value={groupZoom}
                  onChange={(event) => setGroupZoom(Number(event.target.value))}
                  className="mt-2 w-full accent-violet-500"
                />
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateGroupCropModal}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveCreateGroupPhotoCrop()}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600"
                >
                  Save photo
                </button>
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
                    aria-label="Go back"
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
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="relative mx-auto grid h-24 w-24 place-items-center rounded-full border-2 border-violet-500/40 bg-[#1a1a27] text-violet-200 transition-all hover:border-violet-300"
                    >
                      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
                      {userAvatar96 ? (
                        <img src={userAvatar96} alt={user?.username ?? 'User'} className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-4xl">person</span>
                      )}
                      </span>
                      <span className="absolute -top-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-violet-200/70 bg-violet-500 text-white shadow-lg shadow-violet-500/40">
                        <span className="material-symbols-outlined text-base">{userAvatar96 ? 'autorenew' : 'add'}</span>
                      </span>
                    </button>
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleSelectProfilePhoto}
                      className="hidden"
                    />
                    <h3 className="mt-3 text-center text-lg font-bold text-slate-100">{user?.username}</h3>
                    <p className="mt-1 text-center text-xs text-slate-400">Click the avatar to upload and crop your profile photo.</p>
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
                    {userAvatar96 ? (
                      <div className="mt-3 text-center">
                        <button
                          onClick={async () => {
                            if (!user) return;
                            try {
                              setAccountBusyAction('photo');
                              setAccountError(null);
                              const res = await removeMyPhoto();
                              await refreshProfile();
                              setAccountSuccess(res.message);
                            } catch (err) {
                              setAccountError(err instanceof Error ? err.message : 'Unable to remove profile photo.');
                            } finally {
                              setAccountBusyAction(null);
                            }
                          }}
                          disabled={accountBusyAction !== null}
                          className="mt-2 text-xs text-rose-300 hover:underline disabled:opacity-60"
                        >
                          Remove profile photo
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="rounded-2xl border border-[#2a2a39] bg-[#13131a] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Public profile</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#2a2a39] bg-[#13131a] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Security</p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAccountPasswords((prev) => !prev)}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200 transition-colors hover:bg-violet-500/20"
                          aria-label={showAccountPasswords ? 'Hide passwords' : 'Show passwords'}
                        >
                          <span className="material-symbols-outlined text-sm leading-none">
                            {showAccountPasswords ? 'visibility_off' : 'visibility'}
                          </span>
                          {showAccountPasswords ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <input
                          type={showAccountPasswords ? 'text' : 'password'}
                          value={accountForm.oldPassword}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                          placeholder="Current password"
                          className="h-10 rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                        <input
                          type={showAccountPasswords ? 'text' : 'password'}
                          value={accountForm.newPassword}
                          onChange={(e) => setAccountForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="New password"
                          className="h-10 rounded-lg border border-[#2a2a39] bg-[#101019] px-3 text-sm text-slate-100 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                        />
                        <input
                          type={showAccountPasswords ? 'text' : 'password'}
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

                    <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-300/90">Danger zone</p>
                      <p className="mt-2 text-xs text-rose-100/90">
                        Deleting your account removes your login credentials permanently. This action cannot be undone.
                      </p>

                      <div className="mt-3 space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-rose-200/85">
                            Type your username to continue
                          </label>
                          <input
                            value={deleteUsernameInput}
                            onChange={(event) => setDeleteUsernameInput(event.target.value)}
                            placeholder={user?.username ?? 'username'}
                            className="h-10 w-full rounded-lg border border-rose-400/35 bg-[#2a1016] px-3 text-sm text-rose-100 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                          />
                        </div>

                        <label className="inline-flex items-center gap-2 text-xs text-rose-100/90">
                          <input
                            type="checkbox"
                            checked={deleteAcknowledge}
                            onChange={(event) => setDeleteAcknowledge(event.target.checked)}
                            className="h-4 w-4 rounded border-rose-400/40 bg-[#2a1016]"
                          />
                          I understand this will permanently disable my account login.
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isDeleteUsernameConfirmed || !deleteAcknowledge) {
                              setAccountError('Confirm username and acknowledgment before deleting account.');
                              return;
                            }
                            setAccountError(null);
                            setDeletePhraseInput('');
                            setDeleteConfirmationOpen(true);
                          }}
                          disabled={!isDeleteUsernameConfirmed || !deleteAcknowledge || deletingAccount}
                          className="rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-rose-600 disabled:opacity-60"
                        >
                          Delete account
                        </button>
                      </div>
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
        {profileCropOpen && selectedProfilePhotoSrc ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              className="w-full max-w-xl rounded-2xl border border-violet-400/35 bg-[#111118] p-5 shadow-2xl shadow-violet-900/25"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85">Edit profile photo</p>
              <p className="mt-2 text-sm text-slate-300">Drag and zoom to align your photo inside the circular frame.</p>

              <div className="relative mt-4 h-[320px] overflow-hidden rounded-2xl border border-[#2a2a39] bg-[#0f0f14]">
                <Cropper
                  image={selectedProfilePhotoSrc}
                  crop={profileCrop}
                  zoom={profileZoom}
                  minZoom={0.35}
                  maxZoom={4}
                  restrictPosition={false}
                  objectFit="contain"
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setProfileCrop}
                  onZoomChange={setProfileZoom}
                  onCropComplete={(_, croppedAreaPixels) => setProfileCroppedAreaPixels(croppedAreaPixels)}
                />
              </div>

              <div className="mt-4">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Zoom</label>
                <input
                  type="range"
                  min={0.35}
                  max={4}
                  step={0.01}
                  value={profileZoom}
                  onChange={(event) => setProfileZoom(Number(event.target.value))}
                  className="mt-2 w-full accent-violet-500"
                />
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeProfileCropModal}
                  disabled={accountBusyAction === 'photo'}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleUploadCroppedPhoto()}
                  disabled={accountBusyAction === 'photo'}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                >
                  {accountBusyAction === 'photo' ? 'Saving...' : 'Save photo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmationOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: 0.26, ease: 'easeInOut' }}
              className="w-full max-w-lg rounded-2xl border border-rose-400/35 bg-[#111118] p-5 shadow-2xl shadow-rose-900/30"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300/90">Final confirmation</p>
              <p className="mt-3 text-sm text-slate-200">
                To permanently delete this account, type <span className="font-bold text-rose-200">DELETE MY ACCOUNT</span>.
              </p>

              <input
                value={deletePhraseInput}
                onChange={(event) => setDeletePhraseInput(event.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="mt-4 h-10 w-full rounded-lg border border-rose-400/35 bg-[#2a1016] px-3 text-sm text-rose-100 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={!isDeletePhraseConfirmed || deletingAccount}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-rose-600 disabled:opacity-60"
                >
                  {deletingAccount ? 'Deleting...' : 'Permanently delete account'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmationOpen(false)}
                  disabled={deletingAccount}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-60"
                >
                  Cancel
                </button>
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
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-300/85">Confirm user block</p>
              <p className="mt-3 text-sm text-slate-200">
                Do you want to block <span className="font-bold text-rose-200">{blockingTarget.username}</span>? This user will not be able to interact with you.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleConfirmBlock()}
                  disabled={friendActionId === blockingTarget.id}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-rose-600 disabled:opacity-70"
                >
                  {friendActionId === blockingTarget.id ? 'Blocking...' : 'Confirm block'}
                </button>
                <button
                  onClick={() => setBlockingTarget(null)}
                  disabled={friendActionId === blockingTarget.id}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
