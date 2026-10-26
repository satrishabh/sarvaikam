import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, name, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-4">
      <img src="/logo-mark.png" alt="" className="mx-auto h-14 w-14 rounded-2xl" />
      <h1 className="mt-6 text-center text-[32px] font-semibold tracking-tight">
        {mode === 'login' ? 'Sign in to Sarvaikam' : 'Create your account'}
      </h1>
      <p className="mt-2 text-center text-[15px] text-muted">
        {mode === 'login' ? 'Pick up where you left off.' : 'Your progress is saved to your skill map.'}
      </p>
      <form onSubmit={submit} className="surface mt-8 space-y-3 p-6">
        {mode === 'register' && (
          <input className="input" aria-label="Name" placeholder="Name" autoComplete="name"
                 value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input className="input" type="email" aria-label="Email" placeholder="Email" autoComplete="email"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" aria-label="Password"
               placeholder={mode === 'register' ? 'Password, at least 8 characters' : 'Password'}
               autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
               value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : undefined} />
        {error && <p role="alert" className="text-[15px] text-danger">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted">
        {mode === 'login' ? 'New to Sarvaikam? ' : 'Already have an account? '}
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
