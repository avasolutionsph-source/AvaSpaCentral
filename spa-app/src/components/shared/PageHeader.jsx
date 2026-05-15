import React, { memo } from 'react';

/**
 * PageHeader - Reusable page header component
 *
 * Provides consistent page header with:
 * - Title and description
 * - Primary action button
 * - Secondary actions
 * - Breadcrumbs (optional)
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description/subtitle
 * @param {Object} props.action - Primary action button config { label, onClick, icon?, disabled? }
 * @param {Array} props.actions - Array of action configs for multiple buttons
 * @param {boolean} props.showAction - Whether to show the primary action (default: true)
 * @param {React.ReactNode} props.children - Additional header content
 * @param {string} props.className - Additional CSS class
 */
const PageHeader = memo(function PageHeader({
  title,
  description,
  action,
  actions,
  showAction = true,
  children,
  className = ''
}) {
  const renderAction = (actionConfig, index = 0) => {
    if (!actionConfig) return null;

    const {
      label,
      onClick,
      icon,
      disabled = false,
      variant = 'primary',
      className: actionClassName = '',
      // Plan-tier gate. When `locked` is true the button still renders
      // (the user can see the feature exists) but is dimmed, a 🔒 prefix
      // appears, and the click still fires onClick — the consumer is
      // expected to use that handler to surface an upgrade-prompt toast.
      locked = false,
      lockTitle,
    } = actionConfig;

    return (
      <button
        key={index}
        type="button"
        className={`btn btn-${variant} ${actionClassName} ${locked ? 'is-plan-locked' : ''}`.trim()}
        onClick={onClick}
        disabled={disabled}
        title={locked ? (lockTitle || 'Upgrade plan to unlock') : undefined}
        style={locked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
      >
        {locked && <span className="btn-icon" aria-hidden="true">🔒</span>}
        {!locked && icon && <span className="btn-icon">{icon}</span>}
        {label}
      </button>
    );
  };

  return (
    <div className={`page-header ${className}`.trim()}>
      <div className="page-header-content">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>

      {showAction && (action || actions) && (
        <div className="page-header-actions">
          {actions ? (
            actions.map((a, i) => renderAction(a, i))
          ) : (
            renderAction(action)
          )}
        </div>
      )}
    </div>
  );
});

/**
 * PageHeaderCompact - Compact version for embedded views or less prominent pages
 */
export const PageHeaderCompact = memo(function PageHeaderCompact({
  title,
  action,
  showAction = true,
  className = ''
}) {
  return (
    <div className={`page-header-compact ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      {showAction && action && (
        <button
          type="button"
          className={`btn btn-${action.variant || 'primary'}`}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon && <span className="btn-icon">{action.icon}</span>}
          {action.label}
        </button>
      )}
    </div>
  );
});

export default PageHeader;
