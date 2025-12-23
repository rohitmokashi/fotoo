export type AuthUser = { id: string; username: string; role: 'user' | 'admin'; displayName?: string };

const STORAGE_KEY = 'fotoo_auth';

export function getAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return parsed as { accessToken: string; user: AuthUser };
  } catch {
    return null;
  }
}

export function setAuth(accessToken: string, user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, user }));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function login(username: string, password: string) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid username or password');
  const data = await res.json();
  return data as { accessToken: string; user: AuthUser };
}

export function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
