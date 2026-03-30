import { FeaturedSquadsSection } from '../components/FeaturedSquadsSection';
import { HeroSection } from '../components/HeroSection';
import { WorkspacePreviewSection } from '../components/WorkspacePreviewSection';
import { useAuth } from '../../auth/context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { GroupSummary, searchGroups } from '../../social/api/socialHubApi';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const homeContainerRef = useRef<HTMLElement | null>(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupSearchError, setGroupSearchError] = useState<string | null>(null);
  const [groupResults, setGroupResults] = useState<GroupSummary[]>([]);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const el = document.getElementById(id);
    if (!el) return;

    // MainLayout uses `pt-24` so reserve that space (6rem = 96px)
    const headerOffset = 96;
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  }, [location]);

  useEffect(() => {
    const query = groupSearchTerm.trim();

    if (!query) {
      setGroupSearchLoading(false);
      setGroupSearchError(null);
      setGroupResults([]);
      return;
    }

    let active = true;
    setGroupSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchGroups(query, 30);
        if (!active) return;
        setGroupResults(res.results);
        setGroupSearchError(null);
      } catch (err) {
        if (!active) return;
        setGroupSearchError(err instanceof Error ? err.message : 'Group search failed.');
        setGroupResults([]);
      } finally {
        if (active) setGroupSearchLoading(false);
      }
    }, 260);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [groupSearchTerm]);

  useEffect(() => {
    const root = homeContainerRef.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('.home-glow-card'),
    ).filter((el) => !el.classList.contains('home-glow-ignore'));

    if (targets.length === 0) {
      root.classList.remove('social-glow-scope');
      return;
    }

    const proximity = 220;
    const fadeDistance = 400;
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
      root.classList.remove('social-glow-scope');
    };
  }, []);

  return (
    <section ref={homeContainerRef}>
      <HeroSection
        searchTerm={groupSearchTerm}
        onSearchTermChange={setGroupSearchTerm}
        searchLoading={groupSearchLoading}
      />
      <FeaturedSquadsSection
        searchTerm={groupSearchTerm}
        searchLoading={groupSearchLoading}
        searchError={groupSearchError}
        groupResults={groupResults}
      />
      {isAuthenticated ? (
        <div className="mx-auto w-full max-w-[1200px] px-6 pb-3">
          <Link
            to="/social"
            className="group relative block overflow-hidden rounded-2xl border border-violet-500/35 bg-gradient-to-br from-violet-500/20 via-[#151324] to-[#0c0d15] p-6 shadow-[0_0_40px_rgba(124,58,237,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-[0_0_55px_rgba(124,58,237,0.35)]"
          >
            <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-violet-500/25 blur-3xl" />
            <span className="pointer-events-none absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl" />
            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200/80">Community Preview</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">Open Social Hub</h3>
                <p className="mt-2 max-w-xl text-sm text-violet-100/85">
                  Requests, squads, and real-time connections: open the social section and manage everything from one panel.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-violet-100">Requests</span>
                  <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-violet-100">Invites</span>
                  <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-violet-100">Trading Squads</span>
                </div>
              </div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/40 bg-violet-400/15 text-violet-100 transition-transform duration-300 group-hover:translate-x-1">
                <span className="material-symbols-outlined text-3xl">arrow_forward</span>
              </div>
            </div>
          </Link>
        </div>
      ) : null}
      {isAuthenticated ? <div className="mx-auto h-px w-full max-w-[1200px] bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" /> : null}
      <WorkspacePreviewSection />
    </section>
  );
}
