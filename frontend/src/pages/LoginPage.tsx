import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register' | 'recover' | 'verify-email';
export default function LoginPage() {
  const { user, login, ready, error: authError } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const business = params.get('account') === 'business';
  if (ready && user) return <Navigate to="/profile" replace />;
  const changeMode = (next: Mode) => { setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmation(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setNotice('');
    if (mode === 'register' && password !== confirmation) { setError('Your passwords do not match. Enter the same password in both fields.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') { await login(email.trim().toLowerCase(), password); navigate('/profile', { replace: true }); }
      else if (mode === 'register') {
        const result = await api.register(name.trim(), email.trim().toLowerCase(), password);
        setNotice(result.message); setPassword(''); setConfirmation('');
      } else setNotice((await api.emailAction(mode, email.trim().toLowerCase())).message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete your request. Try again.'); }
    finally { setBusy(false); }
  };
  const title = { login: 'Welcome back.', register: 'Make room for your next skill.', recover: 'Reset your password.', 'verify-email': 'Verify your email.' }[mode];
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_440px] lg:items-start">
      <section className="order-2 pt-4 lg:sticky lg:top-28 lg:order-1">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1 className="mt-4 max-w-lg text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[1.08] tracking-tightest">One account.<br />A world to learn.</h1>
        <p className="mt-6 max-w-md text-muted">Build your skills, prepare for your next interview, and pick up exactly where you left off.</p>
        <ol className="mt-10 max-w-md space-y-6">
          {[
            ['01', 'Start learning right away', 'Normal accounts need no manual approval. Just verify your email.'],
            ['02', 'Keep your momentum', 'Your completed lessons and learning progress stay with you.'],
            ['03', 'Grow with your business', 'Apply for business access from your profile. Approved businesses get exclusive content at no charge.'],
          ].map(([n, heading, copy]) => <li key={n} className="flex gap-4"><span className="mt-1 font-mono text-sm text-muted">{n}</span><div><h2 className="font-semibold">{heading}</h2><p className="mt-1 text-base text-muted">{copy}</p></div></li>)}
        </ol>
        <Link to="/" className="link mt-10 inline-flex min-h-11 items-center">Explore the learning library</Link>
      </section>
      <section className="surface order-1 p-6 sm:p-8 lg:order-2" aria-labelledby="login-title">
        <div className="mb-7 flex gap-2 border-b border-line pb-4" aria-label="Account options">
          <button type="button" className={mode === 'login' ? 'btn' : 'btn-quiet'} aria-pressed={mode === 'login'} onClick={() => changeMode('login')} disabled={busy}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'btn' : 'btn-quiet'} aria-pressed={mode === 'register'} onClick={() => changeMode('register')} disabled={busy}>Create account</button>
        </div>
        <h2 id="login-title" className="text-2xl font-semibold leading-tight">{title}</h2>
        <p className="mt-2 text-base text-muted">{mode === 'register' ? 'Create your account, verify your email, then sign in.' : mode === 'login' ? 'Sign in with your Sarvaikam email and password.' : 'We will email you a secure link to continue.'}</p>
        {business && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">Create or sign in to your account, then apply for business access from your profile.</p>}
        <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
          <fieldset disabled={busy || !ready} className="space-y-4">
            {mode === 'register' && <label className="field">Full name<input className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label>}
            <label className="field">Email address<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" maxLength={254} required placeholder="you@example.com" /></label>
            {(mode === 'login' || mode === 'register') && <>
              <div className="field"><label htmlFor="password">Password</label><div className="relative"><input id="password" className="input pr-20" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128} aria-describedby={mode === 'register' ? 'password-help' : undefined} /><button type="button" className="absolute right-2 top-0 min-h-11 px-2 text-sm text-accent" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></div>
              {mode === 'register' && <><p id="password-help" className="text-sm text-muted">Use 12–128 characters. Avoid including your email address.</p><label className="field">Confirm password<input className="input" type={showPassword ? 'text' : 'password'} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required maxLength={128} /></label></>}
            </>}
            <button className="btn w-full" disabled={busy || !ready}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'recover' ? 'Send reset link' : 'Send verification link'}</button>
          </fieldset>
          {(error || authError) && <p role="alert" className="rounded-xl bg-danger/5 p-3 text-base text-danger">{error || authError}</p>}
          {notice && <div role="status" className="rounded-xl bg-accent-soft p-4 text-base"><p>{notice}</p><button type="button" className="link mt-2 min-h-11" onClick={() => changeMode('login')}>Return to sign in</button></div>}
        </form>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm"><button className="link min-h-11" disabled={busy} onClick={() => changeMode('recover')}>Forgot password?</button><button className="link min-h-11" disabled={busy} onClick={() => changeMode('verify-email')}>Resend verification</button></div>
        <p className="mt-5 border-t border-line pt-5 text-sm text-muted">Your email must be verified before you can sign in. Business access is reviewed separately.</p>
      </section>
    </div>
  );
}
