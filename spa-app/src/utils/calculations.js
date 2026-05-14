/**
 * Business Calculation Utilities
 *
 * Pure functions for business logic calculations.
 * These are extracted for testability and reusability.
 */

/**
 * Calculate commission based on employee commission settings
 * @param {number} transactionTotal - Total transaction amount
 * @param {object} commissionConfig - Commission configuration { type: 'percentage'|'fixed', value: number }
 * @returns {number} Commission amount
 */
export function calculateCommission(transactionTotal, commissionConfig) {
  if (!commissionConfig || !transactionTotal) {
    return 0;
  }

  if (commissionConfig.type === 'percentage') {
    return transactionTotal * (commissionConfig.value / 100);
  }

  if (commissionConfig.type === 'fixed') {
    return commissionConfig.value;
  }

  return 0;
}

/**
 * Calculate total commissions for multiple transactions
 * @param {Array} transactions - Array of transactions with total property
 * @param {object} commissionConfig - Commission configuration
 * @returns {number} Total commission amount
 */
export function calculateTotalCommissions(transactions, commissionConfig) {
  if (!Array.isArray(transactions) || !commissionConfig) {
    return 0;
  }

  return transactions.reduce((total, transaction) => {
    return total + calculateCommission(transaction.total, commissionConfig);
  }, 0);
}

/**
 * Calculate overtime pay
 * @param {number} overtimeHours - Number of overtime hours
 * @param {number} hourlyRate - Regular hourly rate
 * @param {number} multiplier - Overtime multiplier (default 1.25 for 25% extra)
 * @returns {number} Overtime pay amount
 */
export function calculateOvertimePay(overtimeHours, hourlyRate, multiplier = 1.25) {
  if (overtimeHours <= 0 || hourlyRate <= 0) {
    return 0;
  }
  return overtimeHours * hourlyRate * multiplier;
}

/**
 * Calculate night differential pay
 * @param {number} nightHours - Number of night shift hours (10pm-6am)
 * @param {number} hourlyRate - Regular hourly rate
 * @param {number} differential - Night differential percentage (default 10%)
 * @returns {number} Night differential amount
 */
export function calculateNightDifferential(nightHours, hourlyRate, differential = 0.10) {
  if (nightHours <= 0 || hourlyRate <= 0) {
    return 0;
  }
  return nightHours * hourlyRate * differential;
}

/**
 * Calculate gross pay
 * @param {number} regularPay - Regular hours pay
 * @param {number} overtimePay - Overtime pay
 * @param {number} commissions - Commission amount
 * @param {number} nightDiffPay - Night differential pay
 * @param {number} allowances - Other allowances
 * @returns {number} Gross pay amount
 */
export function calculateGrossPay(regularPay, overtimePay = 0, commissions = 0, nightDiffPay = 0, allowances = 0) {
  return regularPay + overtimePay + commissions + nightDiffPay + allowances;
}

/**
 * Calculate net pay after deductions
 * @param {number} grossPay - Gross pay amount
 * @param {object} deductions - Deductions object { sss, philhealth, pagibig, tax, other }
 * @returns {number} Net pay amount
 */
export function calculateNetPay(grossPay, deductions = {}) {
  const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
  return Math.max(0, grossPay - totalDeductions);
}

/**
 * Calculate discount amount
 * @param {number} subtotal - Original amount
 * @param {string} discountType - Type of discount ('percentage' or 'fixed')
 * @param {number} discountValue - Discount value
 * @returns {number} Discount amount
 */
export function calculateDiscount(subtotal, discountType, discountValue) {
  if (!subtotal || !discountValue) {
    return 0;
  }

  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100);
  }

  if (discountType === 'fixed') {
    return Math.min(discountValue, subtotal); // Can't discount more than subtotal
  }

  return 0;
}

/**
 * Calculate inventory value
 * @param {number} quantity - Number of items
 * @param {number} costPrice - Cost per item
 * @returns {number} Total inventory value
 */
export function calculateInventoryValue(quantity, costPrice) {
  if (quantity <= 0 || costPrice <= 0) {
    return 0;
  }
  return quantity * costPrice;
}

/**
 * Check if inventory is low stock
 * @param {number} currentStock - Current stock quantity
 * @param {number} lowStockThreshold - Low stock alert threshold
 * @returns {boolean} True if stock is low
 */
export function isLowStock(currentStock, lowStockThreshold = 10) {
  return currentStock <= lowStockThreshold;
}

/**
 * Calculate profit margin
 * @param {number} sellingPrice - Selling price
 * @param {number} costPrice - Cost price
 * @returns {number} Profit margin percentage
 */
export function calculateProfitMargin(sellingPrice, costPrice) {
  if (sellingPrice <= 0 || costPrice < 0) {
    return 0;
  }
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

/**
 * Round to currency (2 decimal places)
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
export function roundToCurrency(amount) {
  return Math.round(amount * 100) / 100;
}
