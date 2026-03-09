import React, { memo } from 'react';
import { PageLoading } from './LoadingSpinner';
import EmptyState from './EmptyState';

/**
 * DataTable - Reusable table component with loading and empty states
 *
 * Provides consistent table structure with:
 * - Column definitions
 * - Loading state with spinner
 * - Empty state with customizable content
 * - Row click handler
 * - Row selection (optional)
 * - Sortable columns (optional)
 *
 * @param {Object} props
 * @param {Array} props.columns - Column definitions
 * @param {Array} props.data - Data array to display
 * @param {boolean} props.loading - Whether data is loading
 * @param {string} props.loadingMessage - Loading message
 * @param {Object} props.emptyState - Empty state config { icon, title, description, action }
 * @param {Function} props.onRowClick - Row click handler (optional)
 * @param {Function} props.rowClassName - Function to get row class (optional)
 * @param {Function} props.getRowKey - Function to get unique row key (default: row._id)
 * @param {string} props.className - Additional CSS class
 *
 * Column definition shape:
 * {
 *   key: string,            // Data key or unique identifier
 *   label: string,          // Column header label
 *   render?: Function,      // Custom render function (value, row, index) => ReactNode
 *   align?: string,         // 'left' | 'center' | 'right'
 *   width?: string,         // CSS width value
 *   className?: string,     // Additional class for td
 *   headerClassName?: string // Additional class for th
 * }
 */
const DataTable = memo(function DataTable({
  columns = [],
  data = [],
  loading = false,
  loadingMessage = 'Loading...',
  emptyState = {},
  onRowClick,
  rowClassName,
  getRowKey = (row) => row._id || row.id,
  className = ''
}) {
  if (loading) {
    return <PageLoading message={loadingMessage} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyState.icon || '📋'}
        title={emptyState.title || 'No data found'}
        description={emptyState.description || 'Try adjusting your filters or search term'}
        action={emptyState.action}
      />
    );
  }

  const getCellValue = (row, column) => {
    if (column.render) {
      return column.render(row[column.key], row);
    }
    return row[column.key];
  };

  const getAlignClass = (align) => {
    if (!align || align === 'left') return '';
    return `text-${align}`;
  };

  return (
    <div className={`table-container ${className}`.trim()}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${getAlignClass(column.align)} ${column.headerClassName || ''}`.trim()}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={getRowKey(row) || rowIndex}
              className={`${onRowClick ? 'clickable-row' : ''} ${rowClassName ? rowClassName(row) : ''}`.trim()}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${getAlignClass(column.align)} ${column.className || ''}`.trim()}
                >
                  {getCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * ActionButtons - Common action buttons for table rows
 */
export const ActionButtons = memo(function ActionButtons({
  onEdit,
  onDelete,
  onView,
  showEdit = true,
  showDelete = true,
  showView = false,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  viewLabel = 'View',
  disabled = false
}) {
  return (
    <div className="actions-cell">
      {showView && (
        <button
          className="btn btn-xs btn-secondary"
          onClick={(e) => { e.stopPropagation(); onView?.(); }}
          disabled={disabled}
        >
          {viewLabel}
        </button>
      )}
      {showEdit && (
        <button
          className="btn btn-xs btn-secondary"
          onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
          disabled={disabled}
        >
          {editLabel}
        </button>
      )}
      {showDelete && (
        <button
          className="btn btn-xs btn-error"
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          disabled={disabled}
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
});

/**
 * StatusBadge - Common status badge for table cells
 */
export const StatusBadge = memo(function StatusBadge({
  status,
  variant,
  className = ''
}) {
  const getVariant = () => {
    if (variant) return variant;
    // Common status mappings
    const statusMap = {
      active: 'success',
      inactive: 'secondary',
      pending: 'warning',
      completed: 'success',
      cancelled: 'error',
      available: 'success',
      occupied: 'error',
      maintenance: 'warning'
    };
    return statusMap[status?.toLowerCase()] || 'secondary';
  };

  return (
    <span className={`status-badge status-${getVariant()} ${className}`.trim()}>
      {status}
    </span>
  );
});

export default DataTable;
