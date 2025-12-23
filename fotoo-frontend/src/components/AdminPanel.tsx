import { useState } from 'react';
import { authHeader, getAuth } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function AdminPanel() {
  const auth = getAuth();
  const token = auth?.accessToken;
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify({ username, email, displayName, password }),
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setInfo(`User created: ${data.username}`);
      setUsername(''); setEmail(''); setDisplayName(''); setPassword('');
    } catch (err: any) {
      setInfo(err?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (!token) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow">
      <h3 className="mb-3 text-base font-semibold">Admin: Create User</h3>
      {info && <div className="mb-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{info}</div>}
      <form onSubmit={createUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2" required />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-onprimary disabled:opacity-50">{busy ? 'Creating…' : 'Create User'}</button>
        </div>
      </form>
    </div>
  );
}
