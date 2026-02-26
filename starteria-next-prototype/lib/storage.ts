'use client';

import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {
      // ignore parse/storage errors
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(key, JSON.stringify(state));
  }, [hydrated, key, state]);

  return { state, setState, hydrated } as const;
}
