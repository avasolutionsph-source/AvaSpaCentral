import React, { memo } from 'react';

/**
 * Accessible Form Field Component (Memoized)
 * Wraps input with label and error display
 */
const FormField = memo(function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder = '',
  helpText = '',
  options = [], // For select type
  rows = 3, // For textarea type
  min,
  max,
  step,
  autoFocus = false,
  className = ''
}) {
  const inputId = `field-${name}`;
  const errorId = `${name}-error`;
  const helpId = `${name}-help`;
  const hasError = touched && error;

  const commonProps = {
    id: inputId,
    name,
    value: value || '',
    onChange,
    onBlur,
    disabled,
    placeholder,
    autoFocus,
    'aria-invalid': hasError ? 'true' : undefined,
    'aria-describedby': [
      hasError ? errorId : null,
      helpText ? helpId : null
    ].filter(Boolean).join(' ') || undefined,
    className: `form-control ${hasError ? 'is-invalid' : ''} ${className}`.trim()
  };

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return <textarea {...commonProps} rows={rows} />;

      case 'select':
        return (
          <select {...commonProps}>
            {placeholder && (
              <option value="">{placeholder}</option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="checkbox-label">
            <input
              type="checkbox"
              id={inputId}
              name={name}
              checked={value || false}
              onChange={onChange}
              onBlur={onBlur}
              disabled={disabled}
              aria-invalid={hasError ? 'true' : undefined}
              aria-describedby={hasError ? errorId : undefined}
            />
            <span className="checkbox-text">{label}</span>
          </label>
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            min={min}
            max={max}
            step={step}
          />
        );

      case 'date':
      case 'time':
      case 'datetime-local':
        return (
          <input
            {...commonProps}
            type={type}
            min={min}
            max={max}
          />
        );

      default:
        return <input {...commonProps} type={type} />;
    }
  };

  // Checkbox has its own label rendering
  if (type === 'checkbox') {
    return (
      <div className={`form-group form-group-checkbox ${hasError ? 'has-error' : ''}`}>
        {renderInput()}
        {hasError && (
          <div id={errorId} className="form-error" role="alert">
            {error}
          </div>
        )}
        {helpText && (
          <div id={helpId} className="form-help">
            {helpText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`form-group ${hasError ? 'has-error' : ''}`}>
      <label htmlFor={inputId} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-hidden="true"> *</span>}
      </label>

      {renderInput()}

      {hasError && (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      )}

      {helpText && !hasError && (
        <div id={helpId} className="form-help">
          {helpText}
        </div>
      )}
    </div>
  );
});

export default FormField;
