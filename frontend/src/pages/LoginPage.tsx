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
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 hover:border-slate-800">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      {mode === 'register' && (
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      )}
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password (min 8 chars)" value={password}
             onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : undefined} />
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button className="btn w-full" disabled={busy}>{mode === 'login' ? 'Login' : 'Register'}</button>
      <button type="button" className="w-full text-sm text-slate-400 underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Login'}
      </button>
    </form>
  );
}
