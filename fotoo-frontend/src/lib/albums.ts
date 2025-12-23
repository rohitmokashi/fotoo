import { authHeader } from './auth';

export type Album = {
  id: string;
  name: string;
  createdAt: string;
};

export type MediaAsset = {
  id: string;
  bucket: string;
  key: string;
  mimeType: string;
  size: string;
  createdAt: string;
  capturedAt?: string;
  owner?: { id: string; username?: string };
};

export type UserSummary = {
  id: string;
  username: string;
  role: 'user' | 'admin';
};

export type AlbumDetail = Album & {
  owner: UserSummary;
  members: UserSummary[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function listAlbums(token: string): Promise<Album[]> {
  const res = await fetch(`${API_BASE}/albums`, { headers: { ...authHeader(token) } });
  if (!res.ok) throw new Error('Failed to list albums');
  return res.json();
}

export async function createAlbum(name: string, token: string): Promise<Album> {
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create album');
  return res.json();
}

export async function listAlbumMedia(albumId: string, token: string): Promise<MediaAsset[]> {
  const res = await fetch(`${API_BASE}/albums/${albumId}/media`, { headers: { ...authHeader(token) } });
  if (!res.ok) throw new Error('Failed to list album media');
  return res.json();
}

export async function requestAlbumUploadUrl(albumId: string, file: File, token: string): Promise<{ uploadUrl: string }>{
  throw new Error('Direct album uploads are disabled');
}

export async function getAlbum(albumId: string, token: string): Promise<AlbumDetail> {
  const res = await fetch(`${API_BASE}/albums/${albumId}`, { headers: { ...authHeader(token) } });
  if (!res.ok) throw new Error('Failed to get album');
  return res.json();
}

export async function addMember(albumId: string, username: string, token: string): Promise<AlbumDetail> {
  const res = await fetch(`${API_BASE}/albums/${albumId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error('Failed to add member');
  return res.json();
}

export async function removeMember(albumId: string, userId: string, token: string): Promise<AlbumDetail> {
  const res = await fetch(`${API_BASE}/albums/${albumId}/members/${userId}`, {
    method: 'DELETE',
    headers: { ...authHeader(token) },
  });
  if (!res.ok) throw new Error('Failed to remove member');
  return res.json();
}

export async function renameAlbum(albumId: string, name: string, token: string): Promise<AlbumDetail> {
  const res = await fetch(`${API_BASE}/albums/${albumId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename album');
  return res.json();
}

export async function deleteAlbum(albumId: string, token: string): Promise<{ success: boolean }>{
  const res = await fetch(`${API_BASE}/albums/${albumId}`, {
    method: 'DELETE',
    headers: { ...authHeader(token) },
  });
  if (!res.ok) throw new Error('Failed to delete album');
  return res.json();
}

export async function addAssetToAlbum(albumId: string, assetId: string, token: string) {
  const res = await fetch(`${API_BASE}/albums/${albumId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ assetId }),
  });
  if (!res.ok) throw new Error('Failed to add asset to album');
  return res.json();
}
