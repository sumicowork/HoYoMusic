import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after the specified delay.
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 300);
 * useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

