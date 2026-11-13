import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { LearningPath } from './learning';

export default function useLearningPaths() {
  const [paths, setPaths] = useState<LearningPath[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let active = true;
    setError('');
    api.paths().then(data => { if (active) setPaths(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  return { paths, error, retry };
}
