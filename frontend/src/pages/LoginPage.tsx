import { useState } from 'react';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login, loginWith, register, ready, error: authError } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const startSignIn = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start sign-in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-4">
      <img src="/logo-mark.png" alt="" className="mx-auto h-14 w-14 rounded-2xl" />
      <h1 className="mt-6 text-center text-[32px] font-semibold tracking-tight">Sign in to Sarvaikam</h1>
      <p className="mt-2 text-center text-[15px] text-muted">
        One secure account for learning and your saved progress.
      </p>
      <div className="surface mt-8 space-y-3 p-6">
        <button className="btn w-full" disabled={!ready || busy} onClick={() => void startSignIn(() => loginWith('google'))}>
          Continue with Google
        </button>
        <button className="btn w-full" disabled={!ready || busy} onClick={() => void startSignIn(() => loginWith('github'))}>
          Continue with GitHub
        </button>
        <button className="btn-quiet w-full" disabled={!ready || busy} onClick={() => void startSignIn(login)}>
          Continue with email
        </button>
        {(error || authError) && <p role="alert" className="text-[15px] text-danger">{error || authError}</p>}
        {!ready && <p className="text-center text-[14px] text-muted">Connecting to secure sign-in…</p>}
      </div>
      <p className="mt-6 text-center text-[15px] text-muted">
        New to Sarvaikam?{' '}
        <button type="button" className="link" disabled={!ready || busy} onClick={() => void startSignIn(register)}>
          Create an account
        </button>
      </p>
    </div>
  );
}
