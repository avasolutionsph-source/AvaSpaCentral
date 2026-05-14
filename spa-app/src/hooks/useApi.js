import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for API calls with loading, error states, and cleanup
 * Prevents memory leaks by tracking mounted state
 *
 * @param {Function} apiFunction - The API function to call
 * @param {Array} dependencies - Dependencies that trigger refetch
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useApi = (apiFunction, dependencies = [], options = {}) => {
  const {
    immediate = true, // Call API immediately on mount
    onSuccess = null, // Callback on successful fetch
    onError = null, // Callback on error
    initialData = null // Initial data value
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiFunction(...args);

      if (isMounted.current) {
        setData(result);
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (isMounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError]);

  useEffect(() => {
    isMounted.current = true;

    if (immediate) {
      fetchData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [...dependencies, immediate]);

  const refetch = useCallback((...args) => {
    return fetchData(...args);
  }, [fetchData]);

  return { data, loading, error, refetch, setData };
};

/**
 * Custom hook for API mutations (POST, PUT, DELETE)
 * Does not auto-execute on mount
 *
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 * @returns {Object} { mutate, data, loading, error, reset }
 */
export const useMutation = (apiFunction, options = {}) => {
  const {
    onSuccess = null,
    onError = null
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const mutate = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiFunction(...args);

      if (isMounted.current) {
        setData(result);
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (isMounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, data, loading, error, reset };
};

export default useApi;
