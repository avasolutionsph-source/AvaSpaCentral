import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useDataLoader - Reusable hook for data fetching with loading/error states
 *
 * Usage:
 * const { data, loading, error, refresh } = useDataLoader(
 *   () => mockApi.products.getProducts(),
 *   [] // dependencies
 * );
 *
 * // With multiple data sources:
 * const { data, loading, error, refresh } = useDataLoader(
 *   async () => {
 *     const [products, categories] = await Promise.all([
 *       mockApi.products.getProducts(),
 *       mockApi.categories.getCategories()
 *     ]);
 *     return { products, categories };
 *   },
 *   []
 * );
 *
 * @param {Function} fetchFn - Async function that fetches data
 * @param {Array} dependencies - Dependencies array for re-fetching
 * @param {Object} options - Configuration options
 * @returns {Object} Data loading state and utilities
 */
const useDataLoader = (fetchFn, dependencies = [], options = {}) => {
  const {
    initialData = null,
    onSuccess = null,
    onError = null,
    enabled = true,
    retryCount = 0,
    retryDelay = 1000
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  const abortController = useRef(null);

  // Load data function
  const loadData = useCallback(async (showLoading = true) => {
    if (!enabled) return;

    // Cancel any previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const result = await fetchFn(abortController.current.signal);

      if (isMounted.current) {
        setData(result);
        setRetries(0);
        if (onSuccess) {
          onSuccess(result);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }

      if (isMounted.current) {
        // Retry logic
        if (retries < retryCount) {
          setRetries(prev => prev + 1);
          setTimeout(() => {
            loadData(false);
          }, retryDelay);
          return;
        }

        setError(err);
        if (onError) {
          onError(err);
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, enabled, retryCount, retryDelay, retries, onSuccess, onError]);

  // Initial load and dependency changes
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Manual refresh function
  const refresh = useCallback(() => {
    setRetries(0);
    return loadData(true);
  }, [loadData]);

  // Refresh without showing loading state (for background refresh)
  const silentRefresh = useCallback(() => {
    setRetries(0);
    return loadData(false);
  }, [loadData]);

  // Update data manually (for optimistic updates)
  const updateData = useCallback((updater) => {
    setData(prev => typeof updater === 'function' ? updater(prev) : updater);
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
    setRetries(0);
  }, [initialData]);

  return {
    // State
    data,
    loading,
    error,

    // Actions
    refresh,
    silentRefresh,
    updateData,
    reset,

    // Computed
    isEmpty: !loading && !error && (data === null || (Array.isArray(data) && data.length === 0)),
    hasData: data !== null && (!Array.isArray(data) || data.length > 0),
    isRetrying: retries > 0
  };
};

/**
 * useMultiDataLoader - Load multiple data sources in parallel
 *
 * Usage:
 * const { data, loading, errors, refresh } = useMultiDataLoader({
 *   products: () => mockApi.products.getProducts(),
 *   categories: () => mockApi.categories.getCategories(),
 *   suppliers: () => mockApi.suppliers.getSuppliers()
 * });
 *
 * // Access: data.products, data.categories, data.suppliers
 */
export const useMultiDataLoader = (fetchFunctions, dependencies = [], options = {}) => {
  const keys = Object.keys(fetchFunctions);

  const combinedFetch = useCallback(async () => {
    const results = await Promise.all(
      keys.map(key => fetchFunctions[key]())
    );

    return keys.reduce((acc, key, index) => {
      acc[key] = results[index];
      return acc;
    }, {});
  }, [fetchFunctions, keys]);

  return useDataLoader(combinedFetch, dependencies, options);
};

export default useDataLoader;
