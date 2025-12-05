import React, { memo } from 'react';

/**
 * Reusable Loading Spinner Component (Memoized)
 *
 * Usage:
 * <LoadingSpinner /> - Full page loading
 * <LoadingSpinner message="Loading data..." />
 * <LoadingSpinner size="sm" inline /> - Inline small spinner
 * <LoadingSpinner size="lg" message="Processing..." />
 *
 * Props:
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - message: string - loading message to display
 * - inline: boolean - render inline instead of full page (default: false)
 * - className: additional CSS classes
 */
const LoadingSpinner = memo(function LoadingSpinner({
  size = 'md',
  message,
  inline = false,
  className = ''
}) {
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner-${size}`,
    className
  ].filter(Boolean).join(' ');

  if (inline) {
    return (
      <span className="loading-inline">
        <span className={spinnerClasses} aria-hidden="true"></span>
        {message && <span className="loading-message-inline">{message}</span>}
      </span>
    );
  }

  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className={spinnerClasses} aria-hidden="true"></div>
      {message && <p className="loading-message">{message}</p>}
      <span className="sr-only">{message || 'Loading...'}</span>
    </div>
  );
});

/**
 * Page-level loading wrapper (Memoized)
 * Centers the spinner in the viewport for full-page loading states
 */
export const PageLoading = memo(function PageLoading({ message = 'Loading...', className = '' }) {
  return (
    <div className={`page-loading ${className}`}>
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
});

export default LoadingSpinner;
