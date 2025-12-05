import React, { memo } from 'react';

/**
 * Reusable Empty State Component (Memoized)
 *
 * Usage:
 * <EmptyState icon="📦" title="No products found" />
 * <EmptyState
 *   icon="📅"
 *   title="No appointments"
 *   description="Try adjusting your filters"
 *   action={{ label: "Create Appointment", onClick: handleCreate }}
 * />
 *
 * Props:
 * - icon: string - emoji or icon to display (default: '📋')
 * - title: string - main heading (required)
 * - description: string - optional helper text
 * - action: { label: string, onClick: function } - optional CTA button
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - className: additional CSS classes
 */
const EmptyState = memo(function EmptyState({
  icon = '📋',
  title,
  description,
  action,
  size = 'md',
  className = ''
}) {
  const containerClasses = [
    'empty-state',
    `empty-state-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && (
        <button
          className="btn btn-primary empty-state-action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

/**
 * Table-specific empty state (spans full table width) (Memoized)
 */
export const TableEmptyState = memo(function TableEmptyState({
  colSpan,
  icon = '📋',
  title = 'No data found',
  description
}) {
  return (
    <tr className="empty-row">
      <td colSpan={colSpan}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          size="sm"
        />
      </td>
    </tr>
  );
});

export default EmptyState;
