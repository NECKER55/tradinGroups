import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import { resolveUserPhotoUrl } from '../utils/cloudinary';

export function MainLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navAvatarUrl = resolveUserPhotoUrl(user?.photo_url, 64);

  return (
    <div className="min-h-screen bg-obsidian text-canvas">
      <nav className="glass-nav fixed left-0 right-0 top-0 z-50 border-b border-canvas/10 px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="rounded-lg bg-signal px-2 py-1">
              <span className="material-symbols-outlined text-2xl leading-none text-obsidian">query_stats</span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-canvas">TradingArena</h2>
          </Link>

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
              <h2 className="text-lg font-black uppercase tracking-tighter text-canvas">TradingArena</h2>
            </div>
            <p className="text-sm leading-relaxed text-canvas/60">
              Competitive trading simulator to learn, compete, and grow without real-world risk.
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-canvas">Platform</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium text-canvas/60">
              <li><a className="transition-colors hover:text-signal" href="#">Market Data</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">Squad Leaderboards</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">League Rules</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-canvas">Support</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium text-canvas/60">
              <li><a className="transition-colors hover:text-signal" href="#">Help Center</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">Trading Guide</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">API Documentation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-xs font-bold uppercase tracking-widest text-canvas">Connect</h4>
            <ul className="flex flex-col gap-4 text-sm font-medium text-canvas/60">
              <li><a className="transition-colors hover:text-signal" href="#">Twitter (X)</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">Discord Community</a></li>
              <li><a className="transition-colors hover:text-signal" href="#">LinkedIn</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
