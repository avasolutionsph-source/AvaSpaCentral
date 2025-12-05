import React, { memo } from 'react';
import './Badge.css';

/**
 * Reusable Badge Component (Memoized)
 *
 * Usage:
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="sm">Pending</Badge>
 * <Badge variant="error" pill>Critical</Badge>
 *
 * Props:
 * - variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' (default: 'neutral')
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - pill: boolean - rounded pill style (default: false)
 * - outline: boolean - outline style instead of filled (default: false)
 * - className: additional CSS classes
 * - children: badge content
 */
const Badge = memo(function Badge({
  variant = 'neutral',
  size = 'md',
  pill = false,
  outline = false,
  className = '',
  children
}) {
  const classes = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    pill && 'badge-pill',
    outline && 'badge-outline',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
});

export default Badge;
