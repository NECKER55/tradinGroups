import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fallito');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-96px)] place-items-center px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-canvas/15 bg-ink/80 p-8">
        <h1 className="text-3xl font-black text-canvas">Bentornato</h1>
        <p className="mt-2 text-sm text-canvas/60">Accedi per entrare nel tuo workspace competitivo.</p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 text-canvas placeholder:text-canvas/35 focus:border-signal focus:outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 text-canvas placeholder:text-canvas/35 focus:border-signal focus:outline-none"
              placeholder="********"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-loss">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-signal py-3 font-bold text-obsidian transition-all hover:bg-signal/90 disabled:opacity-70"
        >
          {loading ? 'Accesso...' : 'Login'}
        </button>

        <p className="mt-5 text-sm text-canvas/60">
          Nessun account?{' '}
          <Link to="/register" className="font-semibold text-signal hover:underline">
            Registrati
          </Link>
        </p>
      </form>
    </section>
  );
}
