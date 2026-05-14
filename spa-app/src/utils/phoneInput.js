/**
 * Sanitize a phone-number input value: strip everything except digits and
 * cap at 11 characters (standard PH mobile length: 09XXXXXXXXX). Designed
 * to be wired into an <input>'s onChange handler so the field rejects
 * letters and never accepts more than 11 digits.
 */
export function sanitizePhoneInput(value) {
  if (value == null) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}

/**
 * Spread these props onto a phone-number <input> for consistent mobile
 * keyboard behavior (numeric pad on iOS/Android) and to pin the maxLength
 * so even paste operations get capped.
 */
export const phoneInputProps = {
  type: 'tel',
  inputMode: 'numeric',
  pattern: '[0-9]*',
  maxLength: 11,
  autoComplete: 'tel',
};
