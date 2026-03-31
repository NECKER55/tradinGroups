import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import { resolveUserPhotoUrl } from '../utils/cloudinary';

type TutorialStep = {
  id: string;
  route: string;
  selector: string;
  title: string;
  description: string;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'home-brand',
    route: '/',
    selector: '[data-tutorial-id="tutorial-brand"]',
    title: 'Brand and global navigation',
    description: 'From here you can always return home, open social features, and start this guided tour again.',
  },
  {
    id: 'home-find-squads',
    route: '/',
    selector: '[data-tutorial-id="home-find-squads"]',
    title: 'Group discovery',
    description: 'Search public squads by name and jump directly to competitive group spaces.',
  },
  {
    id: 'home-featured-squads',
    route: '/',
    selector: '[data-tutorial-id="home-featured-squads"]',
    title: 'Featured squads section',
    description: 'This panel highlights top groups and quick ranking previews to compare active communities.',
  },
  {
    id: 'home-private-overview',
    route: '/',
    selector: '[data-tutorial-id="home-private-area-overview"]',
    title: 'Private personal area',
    description: 'This is your private trading workspace, fully separated from any group portfolio.',
  },
  {
    id: 'home-private-search',
    route: '/',
    selector: '[data-tutorial-id="home-private-search-bar"]',
    title: 'Stock search bar',
    description: 'Search stocks by ticker or company name and open the stock detail page immediately.',
  },
  {
    id: 'home-private-chart',
    route: '/',
    selector: '[data-tutorial-id="home-private-portfolio-chart"]',
    title: 'Portfolio chart',
    description: 'Track your private portfolio value over time with filters and interactive points. it will update once a day',
  },
  {
    id: 'home-private-assets',
    route: '/',
    selector: '[data-tutorial-id="home-private-tab-assets"]',
    title: 'My Assets',
    description: 'Open holdings allocation and per-stock performance in your private area.',
  },
  {
    id: 'home-private-history',
    route: '/',
    selector: '[data-tutorial-id="home-private-tab-history"]',
    title: 'Transaction History',
    description: 'Review your private executed and pending operations with filters and status.',
  },
  {
    id: 'home-private-watchlist',
    route: '/',
    selector: '[data-tutorial-id="home-private-tab-watchlist"]',
    title: 'Watchlist',
    description: 'Keep tracked symbols ready to open and trade from your private workspace.',
  },
  {
    id: 'social-search',
    route: '/social',
    selector: '[data-tutorial-id="social-search-panel"]',
    title: 'Social search',
    description: 'Switch between user search and group search to connect with people and discover new squads.',
  },
  {
    id: 'social-actions',
    route: '/social',
    selector: '[data-tutorial-id="social-actions-panel"]',
    title: 'Requests and invites',
    description: 'Manage friendship requests and group invites from this quick-access action area.',
  },
  {
    id: 'social-connections',
    route: '/social',
    selector: '[data-tutorial-id="social-connections"]',
    title: 'Connections panel',
    description: 'Track your accepted friends and keep your social network up to date.',
  },
  {
    id: 'social-squads',
    route: '/social',
    selector: '[data-tutorial-id="social-squads"]',
    title: 'Trading squads panel',
    description: 'Open your groups, inspect previews, and create new squads with custom settings and invites.',
  },
  {
    id: 'mock-group-ranking',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-ranking"]',
    title: 'Group ranking and competition',
    description: 'This is the competitive layer of groups: members are ranked by performance in the same group domain.',
  },
  {
    id: 'mock-group-personal-area',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-personal-area"]',
    title: 'Group personal trading area',
    description: 'This mock reproduces the real trading workspace layout used in group scope. It is like your private area but with group-wide performance and holdings. Complitely separrated',
  },
  {
    id: 'mock-group-search',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-search-bar"]',
    title: 'Group stock search',
    description: 'Search stocks by ticker or company name directly in the group scope.',
  },
  {
    id: 'mock-group-chart',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-portfolio-chart"]',
    title: 'Group portfolio chart',
    description: 'Track group portfolio evolution over time in the same chart interaction model.',
  },
  {
    id: 'mock-group-assets',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-tab-assets"]',
    title: 'Group My Assets',
    description: 'Open holdings and performance at group scope.',
  },
  {
    id: 'mock-group-history',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-tab-history"]',
    title: 'Group Transaction History',
    description: 'Inspect the transaction timeline and status in group scope.',
  },
  {
    id: 'mock-group-watchlist',
    route: '/tutorial/mock-group',
    selector: '[data-tutorial-id="mock-group-tab-watchlist"]',
    title: 'Group Watchlist',
    description: 'Track symbols in the same watchlist experience inside group area.',
  },
];

export function MainLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navAvatarUrl = resolveUserPhotoUrl(user?.photo_url, 64);
  const [promptOpen, setPromptOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [pageChangeNotice, setPageChangeNotice] = useState<{ title: string; subtitle: string } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const previousTutorialRouteRef = useRef<string | null>(null);

  const currentStep = TUTORIAL_STEPS[tutorialIndex] ?? null;

  useEffect(() => {
    if (!isAuthenticated || tutorialActive) return;
    if (typeof window === 'undefined') return;

    const shouldAutoStart = window.localStorage.getItem('tradingiq_tutorial_autostart') === '1';
    if (!shouldAutoStart) return;

    window.localStorage.removeItem('tradingiq_tutorial_autostart');
    setPromptOpen(false);
    setTutorialIndex(0);
    setTutorialActive(true);
    navigate('/');
  }, [isAuthenticated, navigate, tutorialActive]);

  useEffect(() => {
    if (!tutorialActive) {
      setTargetRect(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('tradingiq_tutorial_active');
      }
      if (location.pathname === '/tutorial/mock-group') {
        navigate('/', { replace: true });
      }
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tradingiq_tutorial_active', '1');
    }

    if (!currentStep) return;

    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
      return;
    }

    let attempts = 0;
    let timer: number | null = null;

    const resolveTarget = () => {
      attempts += 1;
      const element = document.querySelector<HTMLElement>(currentStep.selector);

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        return;
      }

      if (attempts < 20) {
        timer = window.setTimeout(resolveTarget, 120);
      } else {
        setTargetRect(null);
      }
    };

    resolveTarget();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [currentStep, location.pathname, navigate, tutorialActive]);

  useEffect(() => {
    if (!tutorialActive || !currentStep || location.pathname !== currentStep.route) return;

    const updateRect = () => {
      const element = document.querySelector<HTMLElement>(currentStep.selector);
      if (!element) {
        setTargetRect(null);
        return;
      }
      setTargetRect(element.getBoundingClientRect());
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [currentStep, location.pathname, tutorialActive]);

  useEffect(() => {
    if (!tutorialActive || !currentStep) {
      previousTutorialRouteRef.current = null;
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      setPageChangeNotice(null);
      return;
    }

    const prevRoute = previousTutorialRouteRef.current;
    previousTutorialRouteRef.current = currentStep.route;

    if (!prevRoute || prevRoute === currentStep.route) return;

    if (currentStep.route === '/social') {
      setPageChangeNotice({
        title: 'SOCIAL HUB',
        subtitle: 'Switching to the social page',
      });
    } else if (currentStep.route === '/tutorial/mock-group') {
      setPageChangeNotice({
        title: 'GROUP WORKSPACE',
        subtitle: 'Switching to the group page tutorial',
      });
    } else {
      setPageChangeNotice(null);
      return;
    }

    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setPageChangeNotice(null);
      noticeTimerRef.current = null;
    }, 1850);
  }, [currentStep, tutorialActive]);

  useEffect(() => {
    if (!tutorialActive) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const blockWheel = (event: Event) => {
      event.preventDefault();
    };

    const blockKeys = (event: KeyboardEvent) => {
      const blocked = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (blocked.includes(event.key)) {
        event.preventDefault();
      }
    };

    window.addEventListener('wheel', blockWheel, { passive: false });
    window.addEventListener('touchmove', blockWheel, { passive: false });
    window.addEventListener('keydown', blockKeys, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('wheel', blockWheel as EventListener);
      window.removeEventListener('touchmove', blockWheel as EventListener);
      window.removeEventListener('keydown', blockKeys);
    };
  }, [tutorialActive]);

  const tooltipStyle = useMemo(() => {
    const margin = 16;
    const panelWidth = Math.min(380, Math.max(260, window.innerWidth - margin * 2));

    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${panelWidth}px`,
      } as const;
    }

    // Keep tutorial panel biased to the right side to avoid left-edge clipping.
    const preferredLeft = targetRect.right + 22;
    const clampedRight = window.innerWidth - panelWidth - margin;
    const left = Math.max(margin, Math.min(clampedRight, preferredLeft));

    const top = Math.min(Math.max(margin, targetRect.top - 8), window.innerHeight - margin - 260);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelWidth}px`,
    } as const;
  }, [targetRect]);

  const highlightStyle = useMemo(() => {
    if (!targetRect) return null;
    const pad = 8;
    return {
      left: `${Math.max(0, targetRect.left - pad)}px`,
      top: `${Math.max(0, targetRect.top - pad)}px`,
      width: `${Math.max(0, targetRect.width + pad * 2)}px`,
      height: `${Math.max(0, targetRect.height + pad * 2)}px`,
    } as const;
  }, [targetRect]);

  function startTutorial() {
    setPromptOpen(false);
    setTutorialIndex(0);
    setTutorialActive(true);
    navigate('/');
  }

  function closeTutorial() {
    setTutorialActive(false);
    setTutorialIndex(0);
    setPromptOpen(false);
  }

  function goNextStep() {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }
    setTutorialIndex((prev) => prev + 1);
  }

  function goPrevStep() {
    if (tutorialIndex <= 0) return;
    setTutorialIndex((prev) => prev - 1);
  }

  return (
    <div className="min-h-screen bg-obsidian text-canvas">
      <nav className="glass-nav fixed left-0 right-0 top-0 z-50 border-b border-canvas/10 px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div data-tutorial-id="tutorial-brand" className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="rounded-lg bg-signal px-2 py-1">
                <span className="material-symbols-outlined text-2xl leading-none text-obsidian">query_stats</span>
              </div>
              <h2 className="text-xl font-black tracking-tight"><span className="text-white">Trading</span><span className="text-signal">IQ</span></h2>
            </Link>
            <button
              type="button"
              onClick={() => setPromptOpen(true)}
              className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-200 transition-all hover:bg-violet-500/25"
            >
              Tutorial
            </button>
          </div>

          {isAuthenticated ? (
            <div className="hidden items-center gap-10 md:flex">
              <Link className="text-sm font-semibold transition-colors hover:text-signal" to="/social">Social</Link>
              <Link className="text-sm font-semibold transition-colors hover:text-signal" to="/#private-area">Private Area</Link>
            </div>
          ) : <div className="hidden md:block" />}

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {user?.is_superuser ? (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-amber-300/55 bg-amber-500/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/30"
                  >
                    Admin
                  </Link>
                ) : null}
                <Link to="/social?account=1" className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-canvas/10">
                  <span className="text-base font-bold text-canvas/85">{user?.username}</span>
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-canvas/20 bg-canvas/10">
                    {navAvatarUrl ? (
                      <img src={navAvatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-base text-canvas/70">person</span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => void logout()}
                  aria-label="Logout"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas/25 bg-canvas/10 text-canvas/75 transition-all hover:bg-canvas/15 hover:text-canvas"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg border border-canvas/20 bg-canvas/5 px-5 py-2 text-sm font-bold transition-all hover:bg-canvas/10"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-signal px-6 py-2 text-sm font-bold text-obsidian shadow-lg shadow-signal/20 transition-all hover:bg-signal/90"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24">
        <Outlet />
      </main>

      <footer className="border-t border-canvas/10 bg-black px-6 py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-signal">query_stats</span>
              <h2 className="text-lg font-black tracking-tighter"><span className="text-white">Trading</span><span className="text-signal">IQ</span></h2>
            </div>
            <p className="text-sm leading-relaxed text-canvas/60">
              Competitive trading simulator to learn, compete, and grow without real-world risk.
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-canvas">Support</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium text-canvas/60">
              <li><a className="transition-colors hover:text-signal" href="mailto:aven00004@gmail.com">Help Center</a></li>
              <li>
                <button
                  type="button"
                  onClick={() => setPromptOpen(true)}
                  className="transition-colors hover:text-signal"
                >
                  Tutorial
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-canvas">Connect</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium text-canvas/60">
              <li><a className="transition-colors hover:text-signal" href="https://andreaveneroni.netlify.app" target="_blank" rel="noreferrer">Website</a></li>
              <li><a className="transition-colors hover:text-signal" href="https://www.linkedin.com/in/andrea-veneroni-45b6622b3?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app" target="_blank" rel="noreferrer">LinkedIn</a></li>
            </ul>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {promptOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/75 p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.26, ease: 'easeInOut' }}
              className="w-full max-w-lg rounded-2xl border border-violet-400/35 bg-[#111118] p-5 shadow-2xl shadow-violet-900/25"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300/90">Interactive Tutorial</p>
              <p className="mt-3 text-sm text-slate-200">
                Do you want to start the guided tutorial? During the guide, page controls will be temporarily locked.
              </p>
              {!isAuthenticated ? (
                <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  You need to be logged in to run the full tutorial (Home, Social, Group preview).
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPromptOpen(false)}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all hover:bg-[#1b1b27]"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={startTutorial}
                  disabled={!isAuthenticated}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all hover:bg-violet-600 disabled:opacity-60"
                >
                  Yes, start
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {tutorialActive && currentStep ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[12001]"
          >
            <div className="absolute inset-0 bg-black/70" />

            {highlightStyle ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-none fixed rounded-2xl border border-violet-400/70 shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_0_32px_rgba(139,92,246,0.28)]"
                style={highlightStyle}
              />
            ) : null}

            <motion.aside
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed rounded-2xl border border-violet-500/35 bg-[#111118] p-4 shadow-2xl shadow-violet-900/30"
              style={tooltipStyle}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300/85">
                Step {tutorialIndex + 1} / {TUTORIAL_STEPS.length}
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-100">{currentStep.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{currentStep.description}</p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrevStep}
                  disabled={tutorialIndex === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a39] bg-[#151525] px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all hover:bg-[#1b1b2d] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeTutorial}
                    className="rounded-lg border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs font-bold uppercase tracking-wide text-rose-200 transition-all hover:bg-rose-500/20"
                  >
                    Exit
                  </button>
                  <button
                    type="button"
                    onClick={goNextStep}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all hover:bg-violet-600"
                  >
                    {tutorialIndex === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>
            </motion.aside>

            <AnimatePresence>
              {pageChangeNotice ? (
                <motion.div
                  key={pageChangeNotice.title}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none fixed inset-0 z-[12003]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_35%,rgba(139,92,246,0.28),rgba(0,0,0,0.82))]" />
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.04, y: -10 }}
                    transition={{ duration: 0.34, ease: 'easeOut' }}
                    className="w-[min(720px,92vw)] overflow-hidden rounded-2xl border border-violet-400/45 bg-[#120f1f]/95 px-7 py-8 shadow-[0_22px_50px_rgba(0,0,0,0.52)] backdrop-blur"
                  >
                    <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-violet-500/35 blur-3xl" />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-fuchsia-500/25 blur-2xl" />
                    <p className="relative text-[11px] font-bold uppercase tracking-[0.24em] text-violet-300/85">Tutorial Navigation</p>
                    <h3 className="relative mt-2 text-3xl font-black tracking-[0.06em] text-white md:text-4xl">{pageChangeNotice.title}</h3>
                    <p className="relative mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-violet-200/90">{pageChangeNotice.subtitle}</p>
                  </motion.div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
