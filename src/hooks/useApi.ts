import { useCallback, useState } from 'react';

export function useApi<T>(request: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await request();
      setData(result);
      return result;
    } catch (requestError) {
      const normalizedError =
        requestError instanceof Error ? requestError : new Error('Request failed.');
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  return { data, isLoading, error, execute };
}
