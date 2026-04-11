import { useState, useEffect, useCallback, useRef } from 'react';
import { getStepData as fetchStepData } from '../services/stepService';

export interface UseStepDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useStepData<T = Record<string, unknown>>(
  projectId: string | undefined,
  stepNumber: number
): UseStepDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchStepData(projectId, stepNumber) as T;
      if (!mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (!mountedRef.current) return;
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId, stepNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch };
}
