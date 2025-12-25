import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Trash2, Video, CheckCircle, Circle, FolderOpen, PenSquare, UserCog, X, Images } from 'lucide-react';
// Using lucide-react for consistent, high-quality icons
import ThemeSwitcher from './components/ThemeSwitcher';
import LoginForm from './components/LoginForm';
import AdminPanel from './components/AdminPanel';
import { getAuth, clearAuth, authHeader } from './lib/auth';
import AlbumPanel from './components/AlbumPanel';
import AlbumMembersPanel from './components/AlbumMembersPanel';
import type { Album } from './lib/albums';
import { listAlbumMedia, addAssetToAlbum, listAlbums } from './lib/albums';
import * as exifr from 'exifr';

type MediaAsset = {
  id: string;
  bucket: string;
  key: string;
  mimeType: string;
  size: string;
  createdAt: string;
  capturedAt?: string;
  owner?: { id: string; username?: string };
  processedKey?: string;
  processedMimeType?: string;
  processedSize?: string;
  status?: 'pending' | 'processing' | 'processed' | 'failed';
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function normalizeDateStringToISO(s: string): string | undefined {
  try {
    let t = s.trim();
    if (/^UTC\s/i.test(t)) {
      t = t.replace(/^UTC\s*/i, '');
      if (!/[zZ]$/.test(t)) t += 'Z';
    }
    t = t.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return undefined;
}

function extractDateFromFilename(name: string): string | undefined {
  try {
    const n = name;
    let m: RegExpMatchArray | null;
    // IMG_YYYYMMDD_HHMMSS or YYYYMMDD_HHMMSS
    m = n.match(/(?:IMG[_-])?(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
    if (m) {
      const [_, y, mo, d, h, mi, s] = m;
      const iso = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
      return iso;
    }
    // YYYY-MM-DD HH.MM.SS or YYYY-MM-DD HH-MM-SS
    m = n.match(/(\d{4})-(\d{2})-(\d{2})[ _](\d{2})[.:\-](\d{2})[.:\-](\d{2})/);
    if (m) {
      const [_, y, mo, d, h, mi, s] = m;
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
    }
    // YYYYMMDD only
    m = n.match(/(\d{4})(\d{2})(\d{2})/);
    if (m) {
      const [_, y, mo, d] = m;
      return new Date(`${y}-${mo}-${d}T00:00:00Z`).toISOString();
    }
  } catch {}
  return undefined;
}

async function extractVideoCreatedAt(file: File): Promise<string | undefined> {
  try {
    const MediaInfo = (await import('mediainfo.js')).default as any;
    const mediaInfo = await MediaInfo({ format: 'JSON' });
    const result = await mediaInfo.analyzeData(
      () => file.size,
      (chunkSize: number, offset: number) => file.slice(offset, offset + chunkSize)
    );
    const tracks: any[] = result?.media?.track || [];
    const collectDates = (obj: any): (string | undefined)[] => [
      obj?.Encoded_Date,
      obj?.['Encoded date'],
      obj?.Tagged_Date,
      obj?.['Tagged date'],
      obj?.Mastered_Date,
      obj?.Recorded_Date,
      obj?.Creation_Time,
      obj?.File_Created_Date,
      obj?.['File creation date'],
      obj?.File_Last_Modified_Date,
      obj?.['File last modification date'],
      obj?.com_apple_quicktime_creationdate,
      obj?.com_apple_quicktime_CreationDate,
      obj?.['com.apple.quicktime.creationdate'],
    ];
    for (const track of tracks) {
      const candidates = collectDates(track);
      for (const s of candidates) {
        if (typeof s === 'string') {
          const iso = normalizeDateStringToISO(s);
          if (iso) return iso;
        }
      }
    }
    // Fallback: check general track specifically if not already matched
    const general = tracks.find((t: any) => t['@type'] === 'General') || tracks[0] || {};
    for (const s of collectDates(general)) {
      if (typeof s === 'string') {
        const iso = normalizeDateStringToISO(s);
        if (iso) return iso;
      }
    }
  } catch {}
  return undefined;
}

async function extractCapturedAt(file: File): Promise<string | undefined> {
  try {
    if (file.type.startsWith('image/')) {
      const output: any = await exifr.parse(file, { tiff: true, ifd0: true, exif: true, xmp: true, reviveValues: true });
      const candidates: Array<Date | string | undefined> = [
        output?.DateTimeOriginal,
        output?.CreateDate,
        output?.ModifyDate,
        output?.DateTimeDigitized,
        output?.DateCreated,
        output?.MediaCreateDate,
        output?.TrackCreateDate,
      ];
      for (const v of candidates) {
        if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
        if (typeof v === 'string') {
          const iso = normalizeDateStringToISO(v);
          if (iso) return iso;
        }
      }
      // If EXIF/XMP missing, try MediaInfo on images too
      const viaMI = await extractVideoCreatedAt(file);
      if (viaMI) return viaMI;
    } else if (file.type.startsWith('video/')) {
      const created = await extractVideoCreatedAt(file);
      if (created) return created;
      const fromName = extractDateFromFilename(file.name);
      if (fromName) return fromName;
      const date = new Date(file.lastModified);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  } catch {}
  return undefined;
}

// Frontend no longer performs format conversion; originals are uploaded and processed in backend

async function requestUploadUrl(file: File, token?: string, capturedAtOverride?: string) {
  const capturedAt = capturedAtOverride ?? await extractCapturedAt(file);
  const res = await fetch(`${API_BASE}/media/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size, capturedAt }),
  });
  if (!res.ok) throw new Error('Failed to get upload URL');
  return res.json();
}

async function uploadToS3(url: string, file: File) {
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error('Upload failed');
}

function App() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [auth, setAuthState] = useState(() => getAuth());
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAlbumsModal, setShowAlbumsModal] = useState(false);
  const [showManageAlbumModal, setShowManageAlbumModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);

  const formatDateHeading = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const groupByDay = (items: MediaAsset[]) => {
    const groups: Record<string, MediaAsset[]> = {};
    for (const a of items) {
      const d = new Date(a.capturedAt ?? a.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      (groups[key] ||= []).push(a);
    }
    const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { groups, sortedKeys };
  };

  const load = async () => {
    if (!auth?.accessToken) return;
    if (selectedAlbum) {
      const data: MediaAsset[] = await listAlbumMedia(selectedAlbum.id, auth.accessToken) as any;
      const sorted = [...data].sort((a, b) => new Date(b.capturedAt ?? b.createdAt).getTime() - new Date(a.capturedAt ?? a.createdAt).getTime());
      setAssets(sorted);
    } else {
      const res = await fetch(`${API_BASE}/media?limit=100`, { headers: { ...authHeader(auth.accessToken) } });
      const data: MediaAsset[] = await res.json();
      const sorted = [...data].sort((a, b) => new Date(b.capturedAt ?? b.createdAt).getTime() - new Date(a.capturedAt ?? a.createdAt).getTime());
      setAssets(sorted);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum, auth?.accessToken]);

  useEffect(() => {
    const loadAlbums = async () => {
      if (!auth?.accessToken) return;
      try {
        const data = await listAlbums(auth.accessToken);
        setAlbums(data);
      } catch (e) {
        // ignore
      }
    };
    loadAlbums();
  }, [auth?.accessToken]);

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (!auth?.accessToken) throw new Error('Please sign in');
      let failed = 0;
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const capturedAt = await extractCapturedAt(file);
          const r = await requestUploadUrl(file, auth.accessToken, capturedAt);
          await uploadToS3(r.uploadUrl, file);
          // enqueue backend processing of the original
          if (r.asset?.id) {
            await fetch(`${API_BASE}/media/${r.asset.id}/process`, { method: 'POST', headers: { ...authHeader(auth.accessToken) } });
          }
          if (selectedAlbum && r.asset?.id) {
            await addAssetToAlbum(selectedAlbum.id, r.asset.id, auth.accessToken);
          }
        } catch (innerErr) {
          failed++;
          const msg = (innerErr as any)?.message || String(innerErr);
          errors.push(`${file.name}: ${msg}`);
        }
      }
      await load();
      if (failed > 0) {
        setError(`Uploaded with ${failed} failure(s):\n${errors.join('\n')}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Upload error');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  // Per-item delete removed in favor of bulk delete

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!auth?.accessToken) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected item(s)?`)) return;
    setBusy(true);
    try {
      let failed = 0;
      for (const id of ids) {
        const del = await fetch(`${API_BASE}/media/${id}`, { method: 'DELETE', headers: { ...authHeader(auth.accessToken) } });
        if (!del.ok) failed++;
      }
      await load();
      clearSelection();
      if (failed > 0) alert(`Failed to delete ${failed} item(s). Some items may be in albums or not owned by you.`);
    } finally {
      setBusy(false);
    }
  };

  const loggedIn = !!auth?.accessToken;
  const isAdmin = auth?.user?.role === 'admin';
  const grouping = useMemo(() => groupByDay(assets), [assets]);

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-sm font-semibold text-text">{title}</div>
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary" />
            <span className="text-xl font-semibold text-text">Fotoo</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme switcher */}
            <ThemeSwitcher />
            {loggedIn ? (
              <>
                {/* Quick album switcher */}
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                  title="All media"
                >
                  <Images className="w-5 h-5" />
                </button>
                <select
                  value={selectedAlbum?.id ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const album = albums.find(a => a.id === id) || null;
                    setSelectedAlbum(album);
                  }}
                  className="rounded-lg border border-border bg-surface px-2 py-2 text-sm min-w-[160px]"
                  title="Switch album"
                >
                  <option value="">Select album…</option>
                  {albums.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {/* Albums modal trigger (advanced) */}
                {/* Albums modal trigger */}
                <button
                  onClick={() => setShowAlbumsModal(true)}
                  className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                  title="Albums"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
                {/* Manage album modal trigger (only when album selected) */}
                {selectedAlbum && (
                  <button
                    onClick={() => setShowManageAlbumModal(true)}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                    title="Manage Album"
                  >
                    <PenSquare className="w-5 h-5" />
                  </button>
                )}
                {/* Admin modal trigger (users) */}
                {isAdmin && (
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                    title="Admin"
                  >
                    <UserCog className="w-5 h-5" />
                  </button>
                )}
                <input ref={inputRef} type="file" multiple accept="image/*,video/*" onChange={onSelectFile} className="hidden" />
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-onprimary hover:opacity-90 disabled:opacity-50"
                  title={busy ? 'Uploading' : 'Upload'}
                >
                  <Upload className="w-5 h-5" />
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={busy || selected.size === 0}
                  className="relative inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-white hover:opacity-90 disabled:opacity-50"
                  title={`Delete Selected (${selected.size})`}
                >
                  <Trash2 className="w-5 h-5" />
                  {selected.size > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-white text-red-600 text-[10px] w-4 h-4 border border-red-600">
                      {selected.size}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { clearAuth(); setAuthState(null); setAssets([]); }}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-600">Please sign in</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {!loggedIn && (
          <div className="flex w-full items-start justify-center">
            <LoginForm onLoggedIn={() => setAuthState(getAuth())} />
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-red-700">{error}</div>
        )}
        {/* Modals */}
        {loggedIn && showAlbumsModal && (
          <Modal title="Albums" onClose={() => setShowAlbumsModal(false)}>
            <AlbumPanel token={auth!.accessToken} selected={selectedAlbum} onSelect={(a) => { setSelectedAlbum(a); setShowAlbumsModal(false); }} />
          </Modal>
        )}
        {loggedIn && selectedAlbum && showManageAlbumModal && (
          <Modal title={`Manage Album: ${selectedAlbum.name}`} onClose={() => setShowManageAlbumModal(false)}>
            <AlbumMembersPanel
              token={auth!.accessToken}
              album={selectedAlbum}
              currentUserRole={auth!.user.role}
              currentUserId={auth!.user.id}
              onDeleted={() => { setSelectedAlbum(null); setShowManageAlbumModal(false); load(); }}
              onRenamed={(name) => setSelectedAlbum({ ...selectedAlbum, name })}
            />
          </Modal>
        )}
        {loggedIn && isAdmin && showAdminModal && (
          <Modal title="Admin" onClose={() => setShowAdminModal(false)}>
            <AdminPanel />
          </Modal>
        )}

        {/* Gallery */}
        {loggedIn && (
          <>
            {assets.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                No assets yet. Click Upload to add files.
              </div>
            ) : (
              <div>
                {grouping.sortedKeys.map((key) => (
                  <section key={key} className="mb-6">
                    <div className="my-2">
                      <div className="text-lg font-semibold text-text">{formatDateHeading(key)}</div>
                      <div className="border-t border-border mt-2" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {grouping.groups[key].map((a) => {
                        const isSelected = selected.has(a.id);
                        return (
                          <article key={a.id} className={`group rounded-xl overflow-hidden border ${isSelected ? 'border-primary' : 'border-border'} bg-surface shadow-sm relative`}>
                            {(a.processedMimeType && (a.processedMimeType.startsWith('image/') || a.processedMimeType.startsWith('video/'))) ? (
                              <>
                                <img
                                  loading="lazy"
                                  src={`${API_BASE}/media/${a.id}/thumbnail?token=${encodeURIComponent(auth!.accessToken)}`}
                                  alt={a.key}
                                  className="aspect-square w-full object-cover"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                {a.processedMimeType.startsWith('video/') && (
                                  <span className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded" title="Video">
                                    <Video className="w-4 h-4" />
                                  </span>
                                )}
                              </>
                            ) : (
                              <div className="aspect-square flex items-center justify-center text-sm text-gray-500">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                  <polygon points="23 7 16 12 23 17 23 7" />
                                  <rect x="1" y="3" width="14" height="18" rx="2" ry="2"></rect>
                                </svg>
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={() => toggleSelect(a.id)}
                                className={`inline-flex items-center justify-center rounded-md p-1 ${isSelected ? 'bg-primary text-onprimary' : 'bg-black/60 text-white'} hover:opacity-90`}
                                title={isSelected ? 'Selected' : 'Select'}
                                aria-label={isSelected ? 'Selected' : 'Select'}
                              >
                                {isSelected ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
