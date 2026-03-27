import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await register({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password,
        confirm_password: confirmPassword,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-96px)] place-items-center px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-canvas/15 bg-ink/80 p-8">
        <h1 className="text-3xl font-black text-canvas">Create account</h1>
        <p className="mt-2 text-sm text-canvas/60">Start your profile and join the challenge.</p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 text-canvas focus:border-signal focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Username</span>
            <input
              type="text"
              minLength={3}
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 text-canvas focus:border-signal focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 pr-11 text-canvas focus:border-signal focus:outline-none"
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

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-canvas/50">Confirm password</span>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-canvas/15 bg-canvas/5 px-4 py-3 pr-11 text-canvas focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-canvas/60 transition-colors hover:text-canvas"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                <span className="material-symbols-outlined text-base leading-none">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
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
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        <p className="mt-5 text-sm text-canvas/60">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-signal hover:underline">
            Go to login
          </Link>
        </p>
      </form>
    </section>
  );
}
