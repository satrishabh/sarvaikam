import { useEffect, useState } from 'react';
import { api } from './api';
import type { PracticeQuestion } from './practice';
export function usePracticeQuestions() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.practiceQuestions().then(items => { if (active) setQuestions(items); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return { questions, loading, error, retry: () => setAttempt(n => n + 1) };
}
