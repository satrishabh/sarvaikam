import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, AuditEntry, can, Permission, Role, RolePolicy, User, ProgressItem } from '../api';
import { useAuth } from '../auth';

const permissionLabels: Record<Permission, [string, string]> = {
  'content.exclusive': ['Read exclusive lessons', 'Unlock business learning content without payment.'],
  'content.manage': ['Manage content and files', 'Create, edit, and delete lessons; upload learning resources.'],
  'assets.download': ['Download resources', 'Download files attached to lessons this role can read.'],
  'candidates.view': ['View candidate profiles', 'Read registered users, business applications, and learning progress.'],
};
const roleName = (role: Role) => ({ ADMIN: 'Admin', BUSINESS: 'Business', USER: 'Normal user' }[role]);

export default function UsersPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles' | 'audit'>('users');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<User | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [progressError, setProgressError] = useState('');
  const [policies, setPolicies] = useState<RolePolicy[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [newRole, setNewRole] = useState<Role>('USER');
  const [disabled, setDisabled] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const allowed = can(user, 'candidates.view');
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true); setError('');
    try {
      if (tab === 'users') { const result = await api.users(search, status, page); setItems(result.items); setTotal(result.total); }
      else if (tab === 'roles' && isAdmin) setPolicies(await api.policies());
      else if (tab === 'audit' && isAdmin) setAudit(await api.audit());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this view'); }
    finally { setLoading(false); }
  }, [allowed, isAdmin, tab, search, status, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setProgress([]); setProgressError('');
    api.userProgress(selected.id).then(p => { if (active) setProgress(p); }).catch(cause => { if (active) setProgressError(cause.message); });
    return () => { active = false; };
  }, [selected?.id]);
  if (!ready) return <p role="status">Loading access…</p>;
  if (!allowed) return <div className="surface p-8"><h1 className="text-3xl font-semibold">Profile management</h1><p className="mt-3 text-muted">Your account needs permission to view candidates.</p><Link to="/profile" className="link mt-5 inline-block">Go to your profile</Link></div>;
  const select = (candidate: User) => { setSelected(candidate); setNewRole(candidate.role); setDisabled(candidate.disabled); setNote(''); setNotice(''); };
  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved'); }
    finally { setBusy(false); }
  };
  const review = (decision: 'APPROVED' | 'REJECTED') => {
    if (!selected) return;
    if (note.trim().length < 3) { setError('Add a review note of at least 3 characters so the applicant knows the outcome.'); return; }
    void act(async () => { const updated = await api.reviewBusiness(selected.id, decision, note.trim()); select(updated); }, decision === 'APPROVED' ? 'Business application approved. Exclusive access is now available at no charge.' : 'Application declined. The applicant can update their details and apply again.');
  };
  const saveAccess = (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    void act(async () => select(await api.updateAccess(selected.id, { role: newRole, disabled })), 'Account access updated.');
  };
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">WORKSPACE / PEOPLE</p><h1 className="mt-3 text-4xl font-semibold tracking-tightest">Profile management</h1><p className="mt-2 text-muted">Know your learners. Review businesses. Shape access.</p></div>{can(user, 'content.manage') && <Link className="btn-quiet border border-line" to="/admin">Content studio</Link>}</header>
    <nav className="flex flex-wrap gap-2 border-b border-line pb-4" aria-label="Profile management views">{(['users', ...(isAdmin ? ['roles', 'audit'] as const : [])] as const).map(t => <button key={t} className={tab === t ? 'btn' : 'btn-quiet'} aria-current={tab === t ? 'page' : undefined} onClick={() => { setTab(t); setSelected(null); setNotice(''); }} disabled={busy}>{t === 'users' ? 'People & applications' : t === 'roles' ? 'Role permissions' : 'Activity log'}</button>)}</nav>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 text-base text-danger"><p className="flex-1">{error}</p><button className="btn-quiet" onClick={() => void load()}>Refresh view</button></div>}
    {notice && <p role="status" className="rounded-xl bg-accent-soft p-4 text-base">{notice}</p>}
    {tab === 'users' && <>
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]"><label className="field">Find a person<input type="search" className="input" placeholder="Name, email, or organization" value={query} maxLength={200} onChange={e => setQuery(e.target.value)} /></label><label className="field">Business application<select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All people</option><option value="PENDING">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Declined</option><option value="NONE">No application</option></select></label></div>
      <div className={`grid items-start gap-6 ${selected ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        <section className="surface min-w-0 overflow-hidden" aria-label="Registered people" aria-busy={loading}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="font-semibold">{status === 'PENDING' ? 'Awaiting review' : 'People'}</h2><p className="text-sm text-muted">{loading ? 'Loading…' : `${total} ${total === 1 ? 'person' : 'people'}`}</p></div>
          {loading ? <div className="space-y-4 p-6" role="status"><p className="sr-only">Loading people</p>{[0, 1, 2].map(n => <div key={n} className="skeleton h-14" />)}</div> : items.length === 0 ? <div className="p-10"><h3 className="font-semibold">No people match this view.</h3><p className="mt-2 text-base text-muted">Try a different search or choose all people.</p></div> : <ul className="divide-y divide-line">{items.map(candidate => <li key={candidate.id}><button onClick={() => select(candidate)} className={`flex min-h-24 w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-track ${selected?.id === candidate.id ? 'bg-accent-soft' : ''}`} aria-pressed={selected?.id === candidate.id}><span className="min-w-0"><span className="block break-words text-base font-semibold">{candidate.name}</span><span className="block break-all text-sm text-muted">{candidate.email}</span>{candidate.organization && <span className="block text-sm text-muted">{candidate.organization}</span>}</span><span className="flex flex-wrap gap-2"><span className="badge">{roleName(candidate.role)}</span>{candidate.businessStatus === 'PENDING' && <span className="badge">Needs review</span>}{candidate.disabled && <span className="badge text-danger">Suspended</span>}</span></button></li>)}</ul>}
          <div className="flex items-center justify-between border-t border-line p-3 text-sm"><button className="btn-quiet" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><button className="btn-quiet" disabled={loading || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div>
        </section>
        {selected && <aside className="surface min-w-0 p-6" aria-labelledby="person-heading"><div className="flex items-start justify-between gap-2"><h2 id="person-heading" className="break-words text-xl font-semibold">{selected.name}</h2><button className="btn-quiet -mr-3" onClick={() => setSelected(null)}>Close</button></div><p className="break-all text-sm text-muted">{selected.email}</p><dl className="mt-5 space-y-4 text-base"><div><dt className="text-sm text-muted">Business status</dt><dd>{selected.businessStatus.toLowerCase()}</dd></div>{selected.organization && <div><dt className="text-sm text-muted">Organization</dt><dd>{selected.organization}</dd></div>}{selected.businessWebsite && <div><dt className="text-sm text-muted">Website</dt><dd className="break-all">{selected.businessWebsite}</dd></div>}{selected.businessReason && <div><dt className="text-sm text-muted">Learning goals</dt><dd className="whitespace-pre-wrap">{selected.businessReason}</dd></div>}{selected.reviewNote && <div><dt className="text-sm text-muted">Review feedback</dt><dd className="whitespace-pre-wrap">{selected.reviewNote}</dd></div>}</dl>
          {isAdmin && selected.businessStatus === 'PENDING' && <div className="mt-6 border-t border-line pt-5"><label className="field">Review note<textarea className="input min-h-24 py-3" value={note} onChange={e => setNote(e.target.value)} minLength={3} maxLength={1000} placeholder="Tell the applicant the outcome and next steps." disabled={busy} /></label><div className="mt-4 flex flex-wrap gap-2"><button className="btn" disabled={busy || note.trim().length < 3 || selected.disabled} onClick={() => review('APPROVED')}>Approve business</button><button className="btn-quiet text-danger" disabled={busy || note.trim().length < 3 || selected.disabled} onClick={() => review('REJECTED')}>Decline</button></div></div>}
          {isAdmin && <form className="mt-6 space-y-4 border-t border-line pt-5" onSubmit={saveAccess}><h3 className="font-semibold">Account access</h3><fieldset disabled={busy} className="space-y-4"><label className="field">Role<select className="input" value={newRole} onChange={e => setNewRole(e.target.value as Role)}><option value="USER">Normal user</option><option value="BUSINESS" disabled={selected.businessStatus !== 'APPROVED'}>Business (approval required)</option><option value="ADMIN">Admin · full access</option></select></label><label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" className="h-5 w-5 accent-accent" checked={disabled} onChange={e => setDisabled(e.target.checked)} />Suspend account</label><p className="text-sm text-muted">Admins can see all candidates and change all access. You cannot remove your own admin access.</p><button className="btn" disabled={busy || (newRole === selected.role && disabled === selected.disabled)}>Save account access</button></fieldset></form>}
          <section className="mt-6 border-t border-line pt-5"><h3 className="font-semibold">Learning progress</h3>{progressError ? <p className="mt-2 text-sm text-danger">{progressError}</p> : <><p className="mt-2 text-base text-muted">{progress.length} completed {progress.length === 1 ? 'lesson' : 'lessons'}</p><ul className="mt-3 max-h-60 space-y-2 overflow-auto text-sm">{progress.map(p => <li key={p.lessonId}><Link className="link" to={`/topics/${p.topicSlug}`}>{p.topicSlug}</Link> · Step ID {p.lessonId}</li>)}</ul></>}</section>
        </aside>}
      </div>
    </>}
    {tab === 'roles' && <section><h2 className="text-2xl font-semibold">Define what each role can do.</h2><p className="mb-6 mt-2 text-base text-muted">Changes apply to current sessions. Normal accounts need no approval. Business membership always requires review. Admin permissions stay fixed.</p>{loading ? <p role="status">Loading permissions…</p> : <div className="grid items-start gap-5 lg:grid-cols-3">{policies.map(policy => <div key={policy.role} className="surface p-6"><h3 className="text-xl font-semibold">{roleName(policy.role)}</h3><p className="mt-1 text-sm text-muted">{policy.role === 'ADMIN' ? 'Full access · always enabled' : policy.role === 'BUSINESS' ? 'Approved businesses · no payment' : 'Immediate access after email verification'}</p><div className="my-6 space-y-4">{(Object.keys(permissionLabels) as Permission[]).map(permission => <label key={permission} className="flex min-h-11 items-start gap-3"><input className="mt-1 h-5 w-5 shrink-0 accent-accent" type="checkbox" checked={policy.permissions.includes(permission)} disabled={policy.role === 'ADMIN' || busy} onChange={e => setPolicies(policies.map(p => p.role === policy.role ? { ...p, permissions: e.target.checked ? [...p.permissions, permission] : p.permissions.filter(x => x !== permission) } : p))} /><span><span className="block text-base font-medium">{permissionLabels[permission][0]}</span><span className="mt-1 block text-sm text-muted">{permissionLabels[permission][1]}</span></span></label>)}</div>{policy.role !== 'ADMIN' && <button className="btn" disabled={busy} onClick={() => void act(() => api.savePolicy(policy.role, policy.permissions), `${roleName(policy.role)} permissions saved.`)}>Save permissions</button>}</div>)}</div>}</section>}
    {tab === 'audit' && <section className="surface overflow-hidden"><div className="border-b border-line p-5"><h2 className="text-xl font-semibold">Recent access activity</h2><p className="text-sm text-muted">Latest 100 applications, reviews, role changes, and permission updates. Times use your local timezone.</p></div>{loading ? <p className="p-6" role="status">Loading activity…</p> : audit.length === 0 ? <p className="p-6 text-muted">Access changes will appear here.</p> : <ol className="divide-y divide-line">{audit.map(entry => <li key={entry.id} className="p-5"><div className="flex flex-wrap justify-between gap-2"><p className="text-base font-semibold">{entry.action.split('.').join(' · ')}</p><time className="text-sm text-muted" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></div><p className="mt-2 break-all text-sm text-muted">Actor: {entry.actor} · Target: {entry.target}</p><details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 text-accent">View change details</summary><pre className="overflow-auto rounded-xl bg-track p-3 text-xs">{JSON.stringify(entry.details, null, 2)}</pre></details></li>)}</ol>}</section>}
  </div>;
}
