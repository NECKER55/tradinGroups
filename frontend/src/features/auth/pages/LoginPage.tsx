import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({
        identifier: identifier.trim(),
        password,
      });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-96px)] place-items-center px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-canvas/15 bg-ink/80 p-8">
        <h1 className="text-3xl font-black text-canvas">Welcome back</h1>
        <p className="mt-2 text-sm text-canvas/60">Log in to access your competitive workspace.</p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Email Or Username</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 text-canvas placeholder:text-canvas/35 focus:border-signal focus:outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 pr-11 text-canvas placeholder:text-canvas/35 focus:border-signal focus:outline-none"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-canvas/60 transition-colors hover:text-canvas"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-base leading-none">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-loss">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-signal py-3 font-bold text-obsidian transition-all hover:bg-signal/90 disabled:opacity-70"
        >
          {loading ? 'Signing in...' : 'Log in'}
        </button>

        <p className="mt-5 text-sm text-canvas/60">
          No account yet?{' '}
          <Link to="/register" className="font-semibold text-signal hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </section>
  );
}
