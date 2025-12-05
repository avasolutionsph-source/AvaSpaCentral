import { useState, useMemo, useCallback } from 'react';

/**
 * useFilteredList - Reusable hook for search and filter functionality
 *
 * Usage:
 * const {
 *   filteredItems, searchTerm, setSearchTerm,
 *   filters, setFilter, clearFilters, sortConfig, setSortConfig
 * } = useFilteredList(items, {
 *   searchFields: ['name', 'email'],
 *   defaultFilters: { status: 'all' },
 *   defaultSort: { field: 'name', direction: 'asc' }
 * });
 *
 * @param {Array} items - The array of items to filter
 * @param {Object} config - Configuration options
 * @returns {Object} Filtering utilities and state
 */
const useFilteredList = (items = [], config = {}) => {
  const {
    searchFields = ['name'],
    defaultFilters = {},
    defaultSort = null,
    caseSensitive = false
  } = config;

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState(defaultSort);

  // Set a single filter value
  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters to defaults
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(defaultFilters);
    setSortConfig(defaultSort);
  }, [defaultFilters, defaultSort]);

  // Toggle sort direction for a field
  const toggleSort = useCallback((field) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { field, direction: 'asc' };
    });
  }, []);

  // Memoized filtered and sorted results
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = caseSensitive ? searchTerm.trim() : searchTerm.trim().toLowerCase();
      result = result.filter(item =>
        searchFields.some(field => {
          const value = getNestedValue(item, field);
          if (value == null) return false;
          const stringValue = String(value);
          return caseSensitive
            ? stringValue.includes(term)
            : stringValue.toLowerCase().includes(term);
        })
      );
    }

    // Apply custom filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value === 'all' || value === '' || value == null) return;

      result = result.filter(item => {
        const itemValue = getNestedValue(item, key);

        // Handle array values (e.g., tags)
        if (Array.isArray(itemValue)) {
          return itemValue.includes(value);
        }

        // Handle boolean filters
        if (typeof value === 'boolean') {
          return itemValue === value;
        }

        // Handle string comparison
        return String(itemValue).toLowerCase() === String(value).toLowerCase();
      });
    });

    // Apply sorting
    if (sortConfig?.field) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.field);
        const bValue = getNestedValue(b, sortConfig.field);

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Handle numeric values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle date values
        if (aValue instanceof Date && bValue instanceof Date) {
          return sortConfig.direction === 'asc'
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        // Handle string values
        const comparison = String(aValue).localeCompare(String(bValue));
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [items, searchTerm, filters, sortConfig, searchFields, caseSensitive]);

  // Statistics
  const stats = useMemo(() => ({
    total: items.length,
    filtered: filteredItems.length,
    hasFilters: searchTerm.trim() !== '' || Object.values(filters).some(v => v !== 'all' && v !== '' && v != null)
  }), [items.length, filteredItems.length, searchTerm, filters]);

  return {
    // Filtered results
    filteredItems,

    // Search
    searchTerm,
    setSearchTerm,

    // Filters
    filters,
    setFilter,
    setFilters,
    clearFilters,

    // Sorting
    sortConfig,
    setSortConfig,
    toggleSort,

    // Stats
    stats,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    hasActiveFilters: stats.hasFilters
  };
};

/**
 * Helper to get nested object values using dot notation
 * e.g., getNestedValue(obj, 'address.city')
 */
function getNestedValue(obj, path) {
  if (!path) return obj;
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value == null) return null;
    value = value[key];
  }

  return value;
}

export default useFilteredList;
