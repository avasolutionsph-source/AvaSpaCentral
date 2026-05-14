import React, { memo } from 'react';

/**
 * FilterBar - Reusable filter and search component for list pages
 *
 * Provides consistent filter UI with:
 * - Search input
 * - Multiple filter dropdowns
 * - Result count display
 * - Clear filters button (optional)
 *
 * @param {Object} props
 * @param {string} props.searchValue - Current search value
 * @param {Function} props.onSearchChange - Search change handler
 * @param {string} props.searchPlaceholder - Search input placeholder
 * @param {Array} props.filters - Array of filter configs
 * @param {Function} props.onFilterChange - Filter change handler (key, value)
 * @param {number} props.resultCount - Number of results to display
 * @param {string} props.resultLabel - Label for results (default: 'items')
 * @param {Function} props.onClearFilters - Clear all filters handler (optional)
 * @param {boolean} props.showSearch - Whether to show search input (default: true)
 * @param {React.ReactNode} props.children - Additional custom filter elements
 * @param {string} props.className - Additional CSS class
 *
 * Filter config shape:
 * {
 *   key: string,           // Filter identifier
 *   value: string,         // Current value
 *   options: [             // Array of options
 *     { value: 'all', label: 'All Items' },
 *     { value: 'active', label: 'Active' }
 *   ],
 *   placeholder?: string,  // Optional placeholder (uses first option if not provided)
 *   className?: string     // Optional additional class
 * }
 */
const FilterBar = memo(function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilterChange,
  resultCount,
  resultLabel = 'items',
  onClearFilters,
  showSearch = true,
  children,
  className = ''
}) {
  const handleSearchChange = (e) => {
    onSearchChange?.(e.target.value);
  };

  const handleFilterChange = (key) => (e) => {
    onFilterChange?.(key, e.target.value);
  };

  const hasActiveFilters = () => {
    if (searchValue.trim()) return true;
    return filters.some(filter => filter.value !== 'all' && filter.value !== '');
  };

  return (
    <div className={`filters-section ${className}`.trim()}>
      <div className="filters-row">
        {showSearch && (
          <div className="search-box">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={handleSearchChange}
              className="search-input"
              aria-label="Search"
            />
          </div>
        )}

        {filters.map((filter) => (
          <select
            key={filter.key}
            value={filter.value}
            onChange={handleFilterChange(filter.key)}
            className={`filter-select ${filter.className || ''}`.trim()}
            aria-label={filter.placeholder || `Filter by ${filter.key}`}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        {children}

        {onClearFilters && hasActiveFilters() && (
          <button
            type="button"
            className="btn btn-sm btn-secondary clear-filters-btn"
            onClick={onClearFilters}
          >
            Clear
          </button>
        )}

        {resultCount !== undefined && (
          <div className="results-count">
            {resultCount} {resultCount === 1 ? resultLabel.replace(/s$/, '') : resultLabel}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * FilterSelect - Standalone filter select component
 * For use when you need individual filter controls
 */
export const FilterSelect = memo(function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className = ''
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`filter-select ${className}`.trim()}
      aria-label={placeholder}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

/**
 * SearchInput - Standalone search input component
 */
export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = ''
}) {
  return (
    <div className={`search-box ${className}`.trim()}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="search-input"
        aria-label="Search"
      />
    </div>
  );
});

export default FilterBar;
