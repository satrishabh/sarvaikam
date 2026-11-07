import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Asset, can } from '../api';
import { useAuth } from '../auth';

function sizeLabel(bytes: number) { return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }
export default function LessonAssets({ lessonId, manage = false }: { lessonId: number; manage?: boolean }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { setLoading(true); try { setAssets(await api.assets(lessonId)); } catch (cause) { setError((cause as Error).message); } finally { setLoading(false); } }, [lessonId]);
  useEffect(() => { void load(); }, [load]);
  const finish = async (id: string) => { await api.finishUpload(id); setPending(null); await load(); setNotice('Resource uploaded and ready to download.'); };
  const upload = async (file: File) => {
    setBusy(true); setError(''); setNotice(''); setPercent(0);
    try {
      if (file.size < 1 || file.size > 2147483648) throw new Error('Choose a file between 1 byte and 2 GB.');
      const ticket = await api.startUpload(lessonId, file);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', ticket.url);
        Object.entries(ticket.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.upload.onprogress = e => { if (e.lengthComputable) setPercent(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The file upload failed. Check your connection and try again.'));
        xhr.onerror = () => reject(new Error('The upload connection failed. Try again.'));
        xhr.send(file);
      });
      setPending(ticket.id);
      await finish(ticket.id);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const download = async (id: string) => {
    setError('');
    try { const { url } = await api.download(id); window.location.assign(url); }
    catch (cause) { setError((cause as Error).message); }
  };
  const remove = async (asset: Asset) => {
    if (!window.confirm(`Delete ${asset.filename}? This removes the resource from the lesson.`)) return;
    setBusy(true); setError('');
    try { await api.deleteAsset(asset.id); await load(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="surface mt-8 p-5" aria-labelledby="resources-heading"><h2 id="resources-heading" className="text-xl font-semibold">Learning resources</h2><p className="mt-1 text-sm text-muted">Files and reference material for this lesson.</p>
    {loading && <p className="mt-4 text-sm" role="status">Loading resources…</p>}
    {!loading && assets.length === 0 && <p className="mt-4 text-base text-muted">No resources attached yet.</p>}
    <ul className="mt-4 divide-y divide-line">{assets.map(asset => <li key={asset.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words text-base font-medium">{asset.filename}</p><p className="text-sm text-muted">{sizeLabel(asset.size)}</p></div>{can(user, 'assets.download') ? <button type="button" className="btn-quiet" onClick={() => void download(asset.id)}>Download</button> : user ? <span className="text-sm text-muted">Downloads unavailable for your role</span> : <Link className="link text-sm" to="/login">Sign in to download</Link>}{manage && <button type="button" disabled={busy} className="btn-quiet text-danger" onClick={() => void remove(asset)}>Delete</button>}</li>)}</ul>
    {manage && <div className="mt-4 border-t border-line pt-4"><label className="field">Upload a resource<input type="file" disabled={busy || !!pending} accept=".pdf,.zip,.mp4,.webm,.txt" className="block min-h-11 w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-track file:px-4 file:py-3 file:font-medium file:text-ink" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /><span className="field-help">PDF, ZIP, MP4, WebM, or text. Up to 2 GB. Keep this page open until the upload finishes.</span></label>{busy && <div className="mt-3"><progress className="h-2 w-full accent-accent" max={100} value={percent} aria-label="File upload" /><p role="status" className="text-sm text-muted">{percent < 100 ? `Uploading ${percent}%` : 'Verifying your file…'}</p></div>}{pending && !busy && <button type="button" className="link mt-3 min-h-11 text-sm" onClick={() => { setBusy(true); void finish(pending).catch(cause => setError(cause.message)).finally(() => setBusy(false)); }}>Retry file verification</button>}</div>}
    {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}{notice && <p className="mt-3 text-sm" role="status">{notice}</p>}
  </section>;
}
