/**
 * Tests for Business Calculation Utilities
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCommission,
  calculateTotalCommissions,
  calculateOvertimePay,
  calculateNightDifferential,
  calculateGrossPay,
  calculateNetPay,
  calculateDiscount,
  calculateInventoryValue,
  isLowStock,
  calculateProfitMargin,
  roundToCurrency
} from './calculations'

describe('Commission Calculations', () => {
  describe('calculateCommission', () => {
    it('calculates percentage commission correctly', () => {
      const result = calculateCommission(1000, { type: 'percentage', value: 10 })
      expect(result).toBe(100)
    })

    it('calculates fixed commission correctly', () => {
      const result = calculateCommission(1000, { type: 'fixed', value: 50 })
      expect(result).toBe(50)
    })

    it('returns 0 for null commission config', () => {
      expect(calculateCommission(1000, null)).toBe(0)
    })

    it('returns 0 for zero transaction', () => {
      expect(calculateCommission(0, { type: 'percentage', value: 10 })).toBe(0)
    })

    it('returns 0 for unknown commission type', () => {
      expect(calculateCommission(1000, { type: 'unknown', value: 10 })).toBe(0)
    })

    it('handles decimal percentages', () => {
      const result = calculateCommission(1000, { type: 'percentage', value: 7.5 })
      expect(result).toBe(75)
    })
  })

  describe('calculateTotalCommissions', () => {
    it('calculates total for multiple transactions', () => {
      const transactions = [
        { total: 1000 },
        { total: 500 },
        { total: 250 }
      ]
      const config = { type: 'percentage', value: 10 }
      expect(calculateTotalCommissions(transactions, config)).toBe(175)
    })

    it('returns 0 for empty transactions', () => {
      expect(calculateTotalCommissions([], { type: 'percentage', value: 10 })).toBe(0)
    })

    it('returns 0 for null inputs', () => {
      expect(calculateTotalCommissions(null, null)).toBe(0)
    })
  })
})

describe('Payroll Calculations', () => {
  describe('calculateOvertimePay', () => {
    it('calculates overtime with default 1.25x multiplier', () => {
      const result = calculateOvertimePay(4, 100) // 4 hours at 100/hr
      expect(result).toBe(500) // 4 * 100 * 1.25
    })

    it('calculates overtime with custom multiplier', () => {
      const result = calculateOvertimePay(4, 100, 1.5)
      expect(result).toBe(600) // 4 * 100 * 1.5
    })

    it('returns 0 for zero hours', () => {
      expect(calculateOvertimePay(0, 100)).toBe(0)
    })

    it('returns 0 for negative hours', () => {
      expect(calculateOvertimePay(-2, 100)).toBe(0)
    })
  })

  describe('calculateNightDifferential', () => {
    it('calculates night diff with default 10%', () => {
      const result = calculateNightDifferential(8, 100)
      expect(result).toBe(80) // 8 * 100 * 0.10
    })

    it('calculates night diff with custom percentage', () => {
      const result = calculateNightDifferential(8, 100, 0.15)
      expect(result).toBe(120) // 8 * 100 * 0.15
    })

    it('returns 0 for zero hours', () => {
      expect(calculateNightDifferential(0, 100)).toBe(0)
    })
  })

  describe('calculateGrossPay', () => {
    it('calculates gross pay with all components', () => {
      const result = calculateGrossPay(10000, 500, 200, 80, 1000)
      expect(result).toBe(11780)
    })

    it('calculates gross pay with only regular pay', () => {
      expect(calculateGrossPay(10000)).toBe(10000)
    })
  })

  describe('calculateNetPay', () => {
    it('calculates net pay after deductions', () => {
      const deductions = { sss: 500, philhealth: 200, pagibig: 100, tax: 1000 }
      const result = calculateNetPay(15000, deductions)
      expect(result).toBe(13200)
    })

    it('returns gross if no deductions', () => {
      expect(calculateNetPay(15000)).toBe(15000)
    })

    it('never returns negative', () => {
      const deductions = { sss: 20000 }
      expect(calculateNetPay(15000, deductions)).toBe(0)
    })
  })
})

describe('Discount Calculations', () => {
  describe('calculateDiscount', () => {
    it('calculates percentage discount', () => {
      const result = calculateDiscount(1000, 'percentage', 20)
      expect(result).toBe(200)
    })

    it('calculates fixed discount', () => {
      const result = calculateDiscount(1000, 'fixed', 150)
      expect(result).toBe(150)
    })

    it('caps fixed discount at subtotal', () => {
      const result = calculateDiscount(100, 'fixed', 150)
      expect(result).toBe(100) // Can't discount more than subtotal
    })

    it('returns 0 for zero subtotal', () => {
      expect(calculateDiscount(0, 'percentage', 20)).toBe(0)
    })

    it('returns 0 for zero discount value', () => {
      expect(calculateDiscount(1000, 'percentage', 0)).toBe(0)
    })
  })
})

describe('Inventory Calculations', () => {
  describe('calculateInventoryValue', () => {
    it('calculates total inventory value', () => {
      expect(calculateInventoryValue(50, 100)).toBe(5000)
    })

    it('returns 0 for zero quantity', () => {
      expect(calculateInventoryValue(0, 100)).toBe(0)
    })

    it('returns 0 for negative quantity', () => {
      expect(calculateInventoryValue(-5, 100)).toBe(0)
    })
  })

  describe('isLowStock', () => {
    it('returns true when stock is below threshold', () => {
      expect(isLowStock(5, 10)).toBe(true)
    })

    it('returns true when stock equals threshold', () => {
      expect(isLowStock(10, 10)).toBe(true)
    })

    it('returns false when stock is above threshold', () => {
      expect(isLowStock(15, 10)).toBe(false)
    })

    it('uses default threshold of 10', () => {
      expect(isLowStock(5)).toBe(true)
      expect(isLowStock(15)).toBe(false)
    })
  })

  describe('calculateProfitMargin', () => {
    it('calculates profit margin correctly', () => {
      const result = calculateProfitMargin(100, 60)
      expect(result).toBe(40) // 40% margin
    })

    it('handles 100% margin (free goods)', () => {
      const result = calculateProfitMargin(100, 0)
      expect(result).toBe(100)
    })

    it('returns 0 for zero selling price', () => {
      expect(calculateProfitMargin(0, 50)).toBe(0)
    })

    it('handles loss (negative margin)', () => {
      const result = calculateProfitMargin(80, 100)
      expect(result).toBe(-25) // Selling below cost
    })
  })
})

describe('Utility Functions', () => {
  describe('roundToCurrency', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundToCurrency(10.256)).toBe(10.26)
      expect(roundToCurrency(10.254)).toBe(10.25)
    })

    it('handles whole numbers', () => {
      expect(roundToCurrency(100)).toBe(100)
    })

    it('handles small decimals', () => {
      expect(roundToCurrency(0.001)).toBe(0)
      expect(roundToCurrency(0.005)).toBe(0.01)
    })
  })
})
