import { useEffect, useState } from 'react';
import type { Album, AlbumDetail } from '../lib/albums';
import { getAlbum, addMember, removeMember, renameAlbum, deleteAlbum } from '../lib/albums';

type Props = {
  token: string;
  album: Album;
  currentUserRole: 'user' | 'admin';
  currentUserId: string;
  onDeleted: () => void;
  onRenamed: (name: string) => void;
};

export default function AlbumMembersPanel({ token, album, currentUserRole, currentUserId, onDeleted, onRenamed }: Props) {
  const [detail, setDetail] = useState<AlbumDetail | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState(album.name);

  const load = async () => {
    try {
      const d = await getAlbum(album.id, token);
      setDetail(d);
      setNewName(d.name);
    } catch (err: any) {
      setError(err?.message || 'Failed to load album');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.id]);

  const isOwner = detail?.owner.id === currentUserId;
  const canManage = isOwner || currentUserRole === 'admin';

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !detail) return;
    setBusy(true);
    setError(null);
    try {
      const d = await addMember(detail.id, username.trim(), token);
      setDetail(d);
      setUsername('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add member');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId: string) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const d = await removeMember(detail.id, userId, token);
      setDetail(d);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove member');
    } finally {
      setBusy(false);
    }
  };

  const onRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const d = await renameAlbum(detail.id, newName.trim(), token);
      setDetail(d);
      onRenamed(d.name);
    } catch (err: any) {
      setError(err?.message || 'Failed to rename album');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!detail) return;
    if (!confirm('Delete this album? Assets will remain but be unassigned.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAlbum(detail.id, token);
      onDeleted();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete album');
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text">Manage Album</h3>
        {canManage && (
          <button
            onClick={onDelete}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
          >
            Delete Album
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600">Owner: {detail.owner.username}</div>
        {canManage && (
          <form onSubmit={onRename} className="mt-2 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
            <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-onprimary disabled:opacity-50">Rename</button>
          </form>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium">Members</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {detail.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <span>{m.username}</span>
              {canManage && (
                <button onClick={() => onRemove(m.id)} className="text-xs text-red-600 hover:underline">Remove</button>
              )}
            </div>
          ))}
          {detail.members.length === 0 && (
            <div className="col-span-full text-sm text-gray-500">No members yet.</div>
          )}
        </div>
      </div>

      {canManage && (
        <form onSubmit={onAdd} className="mt-3 flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Add member by username"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-onprimary disabled:opacity-50">Add</button>
        </form>
      )}
    </div>
  );
}
