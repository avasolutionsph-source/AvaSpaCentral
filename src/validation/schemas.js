/**
 * Validation Schemas for Entity Forms
 *
 * Each schema defines validation rules for form fields.
 * Used with useCrudOperations hook validateForm function.
 *
 * Rule properties:
 * - required: boolean - Field is required
 * - requiredMessage: string - Custom required message
 * - minLength: number - Minimum string length
 * - maxLength: number - Maximum string length
 * - min: number - Minimum numeric value
 * - max: number - Maximum numeric value
 * - email: boolean - Validate email format
 * - phone: boolean - Validate phone format (Philippine)
 * - pattern: RegExp - Custom regex pattern
 * - patternMessage: string - Custom pattern error message
 * - validate: function - Custom validation function (value, allValues) => true | errorMessage
 */

// Common validation patterns
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+63|0)?[0-9]{10,11}$/,
  positiveNumber: /^[0-9]+(\.[0-9]+)?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/
};

// Common validation functions
export const validators = {
  isPositiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
  },
  isNonNegative: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 ? true : 'Must be zero or positive';
  },
  isValidEmail: (value) => {
    if (!value) return true;
    return patterns.email.test(value) ? true : 'Invalid email format';
  },
  isValidPhone: (value) => {
    if (!value) return true;
    const cleaned = value.replace(/\s|-/g, '');
    return patterns.phone.test(cleaned) ? true : 'Invalid phone number';
  }
};

// Room validation schema
export const roomValidation = {
  name: {
    required: true,
    requiredMessage: 'Room name is required',
    minLength: 1,
    maxLength: 100
  },
  type: {
    required: true,
    requiredMessage: 'Room type is required'
  },
  capacity: {
    required: true,
    requiredMessage: 'Capacity is required',
    min: 1,
    minMessage: 'Capacity must be at least 1'
  }
};

// Product validation schema
export const productValidation = {
  name: {
    required: true,
    requiredMessage: 'Product name is required',
    minLength: 2,
    maxLength: 200
  },
  category: {
    required: true,
    requiredMessage: 'Category is required'
  },
  price: {
    required: true,
    requiredMessage: 'Price is required',
    validate: validators.isPositiveNumber
  },
  type: {
    required: true,
    requiredMessage: 'Product type is required'
  }
};

// Employee validation schema
export const employeeValidation = {
  firstName: {
    required: true,
    requiredMessage: 'First name is required',
    minLength: 2,
    maxLength: 50
  },
  lastName: {
    required: true,
    requiredMessage: 'Last name is required',
    minLength: 2,
    maxLength: 50
  },
  email: {
    required: true,
    requiredMessage: 'Email is required',
    email: true,
    emailMessage: 'Invalid email format'
  },
  phone: {
    required: true,
    requiredMessage: 'Phone number is required',
    phone: true,
    phoneMessage: 'Invalid phone number format'
  },
  position: {
    required: true,
    requiredMessage: 'Position is required'
  },
  department: {
    required: true,
    requiredMessage: 'Department is required'
  },
  hourlyRate: {
    required: true,
    requiredMessage: 'Hourly rate is required',
    validate: validators.isNonNegative
  }
};

// Customer validation schema
export const customerValidation = {
  firstName: {
    required: true,
    requiredMessage: 'First name is required',
    minLength: 2
  },
  lastName: {
    required: true,
    requiredMessage: 'Last name is required',
    minLength: 2
  },
  email: {
    required: false,
    email: true,
    emailMessage: 'Invalid email format'
  },
  phone: {
    required: true,
    requiredMessage: 'Phone number is required',
    phone: true
  }
};

// Supplier validation schema
export const supplierValidation = {
  name: {
    required: true,
    requiredMessage: 'Supplier name is required',
    minLength: 2,
    maxLength: 200
  },
  contactPerson: {
    required: true,
    requiredMessage: 'Contact person is required'
  },
  email: {
    required: true,
    requiredMessage: 'Email is required',
    email: true
  },
  phone: {
    required: true,
    requiredMessage: 'Phone number is required',
    phone: true
  }
};

// Expense validation schema
export const expenseValidation = {
  description: {
    required: true,
    requiredMessage: 'Description is required',
    minLength: 3
  },
  amount: {
    required: true,
    requiredMessage: 'Amount is required',
    validate: validators.isPositiveNumber
  },
  category: {
    required: true,
    requiredMessage: 'Category is required'
  },
  date: {
    required: true,
    requiredMessage: 'Date is required'
  }
};

// Purchase Order validation schema
export const purchaseOrderValidation = {
  supplierId: {
    required: true,
    requiredMessage: 'Supplier is required'
  },
  orderDate: {
    required: true,
    requiredMessage: 'Order date is required'
  }
};

// Gift Certificate validation schema
export const giftCertificateValidation = {
  recipientName: {
    required: true,
    requiredMessage: 'Recipient name is required'
  },
  amount: {
    required: true,
    requiredMessage: 'Amount is required',
    validate: validators.isPositiveNumber
  },
  expiresAt: {
    required: true,
    requiredMessage: 'Expiration date is required'
  }
};

// Appointment validation schema
export const appointmentValidation = {
  customerId: {
    required: true,
    requiredMessage: 'Customer is required'
  },
  serviceId: {
    required: true,
    requiredMessage: 'Service is required'
  },
  employeeId: {
    required: true,
    requiredMessage: 'Therapist is required'
  },
  scheduledDateTime: {
    required: true,
    requiredMessage: 'Date and time is required'
  }
};

/**
 * Create a validator function from a schema
 * Returns a function compatible with useCrudOperations validateForm
 *
 * @param {Object} schema - Validation schema
 * @param {Function} showToast - Toast function for showing errors
 * @returns {Function} Validator function
 */
export const createValidator = (schema, showToast) => {
  return (formData) => {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = formData[field];

      // Required check
      if (rules.required) {
        const isEmpty = value === undefined || value === null ||
          (typeof value === 'string' && !value.trim()) ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          const message = rules.requiredMessage || `${field} is required`;
          errors[field] = message;
          if (showToast) showToast(message, 'error');
          continue; // Skip other validations if required fails
        }
      }

      // Skip further validation if value is empty and not required
      if (value === undefined || value === null || value === '') continue;

      // String validations
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors[field] = rules.minLengthMessage || `Minimum ${rules.minLength} characters required`;
          if (showToast) showToast(errors[field], 'error');
          continue;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          errors[field] = rules.maxLengthMessage || `Maximum ${rules.maxLength} characters allowed`;
          if (showToast) showToast(errors[field], 'error');
          continue;
        }
      }

      // Number validations
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (rules.min !== undefined && numValue < rules.min) {
          errors[field] = rules.minMessage || `Minimum value is ${rules.min}`;
          if (showToast) showToast(errors[field], 'error');
          continue;
        }

        if (rules.max !== undefined && numValue > rules.max) {
          errors[field] = rules.maxMessage || `Maximum value is ${rules.max}`;
          if (showToast) showToast(errors[field], 'error');
          continue;
        }
      }

      // Email validation
      if (rules.email && !patterns.email.test(value)) {
        errors[field] = rules.emailMessage || 'Invalid email format';
        if (showToast) showToast(errors[field], 'error');
        continue;
      }

      // Phone validation
      if (rules.phone) {
        const cleaned = value.replace(/\s|-/g, '');
        if (!patterns.phone.test(cleaned)) {
          errors[field] = rules.phoneMessage || 'Invalid phone number';
          if (showToast) showToast(errors[field], 'error');
          continue;
        }
      }

      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[field] = rules.patternMessage || 'Invalid format';
        if (showToast) showToast(errors[field], 'error');
        continue;
      }

      // Custom validation
      if (rules.validate && typeof rules.validate === 'function') {
        const result = rules.validate(value, formData);
        if (result !== true) {
          errors[field] = result || 'Invalid value';
          if (showToast) showToast(errors[field], 'error');
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
};

/**
 * Simple validation function that shows first error via toast
 * For backward compatibility with existing validation pattern
 *
 * @param {Object} schema - Validation schema
 * @param {Object} formData - Form data to validate
 * @param {Function} showToast - Toast function
 * @returns {boolean} Whether form is valid
 */
export const validateWithToast = (schema, formData, showToast) => {
  const validator = createValidator(schema, showToast);
  const result = validator(formData);
  return result.isValid;
};

export default {
  room: roomValidation,
  product: productValidation,
  employee: employeeValidation,
  customer: customerValidation,
  supplier: supplierValidation,
  expense: expenseValidation,
  purchaseOrder: purchaseOrderValidation,
  giftCertificate: giftCertificateValidation,
  appointment: appointmentValidation,
  createValidator,
  validateWithToast,
  patterns,
  validators
};
