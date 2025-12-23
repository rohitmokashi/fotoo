import { useEffect, useState } from 'react';
import type { Album } from '../lib/albums';
import { listAlbums, createAlbum } from '../lib/albums';

type Props = {
  token: string;
  selected: Album | null;
  onSelect: (album: Album | null) => void;
};

export default function AlbumPanel({ token, selected, onSelect }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await listAlbums(token);
      setAlbums(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load albums');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const album = await createAlbum(name.trim(), token);
      setName('');
      setAlbums((prev) => [album, ...prev]);
      onSelect(album);
    } catch (err: any) {
      setError(err?.message || 'Failed to create album');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text">Albums</h2>
        <button
          className="text-sm underline"
          onClick={() => onSelect(null)}
        >
          View all media
        </button>
      </div>

      <form onSubmit={onCreate} className="flex gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New album name"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-2 text-sm text-onprimary disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {albums.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className={`rounded-md border px-3 py-2 text-sm ${selected?.id === a.id ? 'border-primary text-primary' : 'border-border text-text'}`}
          >
            {a.name}
          </button>
        ))}
        {albums.length === 0 && (
          <div className="col-span-full text-sm text-gray-500">No albums yet. Create one above.</div>
        )}
      </div>
    </div>
  );
}
