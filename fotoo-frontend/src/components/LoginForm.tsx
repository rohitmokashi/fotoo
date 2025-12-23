import { useState } from 'react';
import { login, setAuth } from '../lib/auth';

export default function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken, user } = await login(username, password);
      setAuth(accessToken, user);
      onLoggedIn();
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm w-full rounded-xl border border-border bg-surface p-4 shadow">
      <h2 className="mb-3 text-lg font-semibold">Sign in</h2>
      {error && <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-3">
        <label className="mb-1 block text-sm text-gray-600">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-2"
          placeholder="admin"
          autoComplete="username"
          required
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm text-gray-600">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-2"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-onprimary disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
