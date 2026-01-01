/**
 * Tests for Date Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatDate,
  formatTime,
  formatDateTime,
  getToday,
  toLocalDateString,
  isToday,
  isPast,
  isFuture,
  addDays,
  startOfDay,
  endOfDay,
  daysBetween,
  formatDuration,
  formatTime12Hour,
  formatTimeRange
} from './dateUtils'

describe('Date Formatting', () => {
  describe('formatDate', () => {
    it('formats date in medium format by default', () => {
      const result = formatDate('2024-12-25')
      expect(result).toContain('Dec')
      expect(result).toContain('25')
      expect(result).toContain('2024')
    })

    it('returns empty string for null', () => {
      expect(formatDate(null)).toBe('')
    })

    it('returns empty string for invalid date', () => {
      expect(formatDate('invalid')).toBe('')
    })

    it('handles Date objects', () => {
      const date = new Date(2024, 11, 25) // Dec 25, 2024
      const result = formatDate(date)
      expect(result).toContain('Dec')
      expect(result).toContain('25')
    })
  })

  describe('formatTime', () => {
    it('formats time in 12-hour format', () => {
      const date = new Date(2024, 0, 1, 14, 30, 0) // 2:30 PM
      const result = formatTime(date)
      expect(result).toMatch(/2:30.*PM/i)
    })

    it('returns empty string for null', () => {
      expect(formatTime(null)).toBe('')
    })

    it('returns empty string for invalid date', () => {
      expect(formatTime('invalid')).toBe('')
    })
  })

  describe('formatDateTime', () => {
    it('combines date and time formatting', () => {
      const date = new Date(2024, 11, 25, 14, 30)
      const result = formatDateTime(date)
      expect(result).toContain('Dec')
      expect(result).toContain('25')
      expect(result).toContain('2024')
      expect(result).toMatch(/PM/i)
    })

    it('returns empty string for null', () => {
      expect(formatDateTime(null)).toBe('')
    })
  })
})

describe('Date Helpers', () => {
  describe('getToday', () => {
    it('returns today in YYYY-MM-DD format', () => {
      const result = getToday()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('toLocalDateString', () => {
    it('converts Date to YYYY-MM-DD', () => {
      const date = new Date(2024, 11, 25) // Dec 25, 2024
      expect(toLocalDateString(date)).toBe('2024-12-25')
    })

    it('handles string input', () => {
      expect(toLocalDateString('2024-12-25')).toBe('2024-12-25')
    })
  })

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true)
    })

    it('returns false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday)).toBe(false)
    })

    it('returns false for null', () => {
      expect(isToday(null)).toBe(false)
    })
  })

  describe('isPast', () => {
    it('returns true for past date', () => {
      const pastDate = new Date('2020-01-01')
      expect(isPast(pastDate)).toBe(true)
    })

    it('returns false for future date', () => {
      const futureDate = new Date('2099-12-31')
      expect(isPast(futureDate)).toBe(false)
    })

    it('returns false for null', () => {
      expect(isPast(null)).toBe(false)
    })
  })

  describe('isFuture', () => {
    it('returns true for future date', () => {
      const futureDate = new Date('2099-12-31')
      expect(isFuture(futureDate)).toBe(true)
    })

    it('returns false for past date', () => {
      const pastDate = new Date('2020-01-01')
      expect(isFuture(pastDate)).toBe(false)
    })

    it('returns false for null', () => {
      expect(isFuture(null)).toBe(false)
    })
  })
})

describe('Date Manipulation', () => {
  describe('addDays', () => {
    it('adds positive days', () => {
      const date = new Date(2024, 0, 1) // Jan 1, 2024
      const result = addDays(date, 5)
      expect(result.getDate()).toBe(6)
    })

    it('subtracts negative days', () => {
      const date = new Date(2024, 0, 10) // Jan 10, 2024
      const result = addDays(date, -5)
      expect(result.getDate()).toBe(5)
    })

    it('handles month boundaries', () => {
      const date = new Date(2024, 0, 31) // Jan 31, 2024
      const result = addDays(date, 1)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(1)
    })
  })

  describe('startOfDay', () => {
    it('sets time to midnight', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45)
      const result = startOfDay(date)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })
  })

  describe('endOfDay', () => {
    it('sets time to end of day', () => {
      const date = new Date(2024, 0, 15, 10, 0, 0)
      const result = endOfDay(date)
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
    })
  })

  describe('daysBetween', () => {
    it('calculates days between two dates', () => {
      const start = new Date(2024, 0, 1)
      const end = new Date(2024, 0, 10)
      expect(daysBetween(start, end)).toBe(9)
    })

    it('returns 0 for same day', () => {
      const date = new Date(2024, 0, 15)
      expect(daysBetween(date, date)).toBe(0)
    })

    it('handles negative difference', () => {
      const start = new Date(2024, 0, 10)
      const end = new Date(2024, 0, 1)
      expect(daysBetween(start, end)).toBe(-9)
    })
  })
})

describe('Duration Formatting', () => {
  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(30)).toBe('30 min')
    })

    it('formats hours only', () => {
      expect(formatDuration(60)).toBe('1 hr')
      expect(formatDuration(120)).toBe('2 hr')
    })

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1 hr 30 min')
      expect(formatDuration(150)).toBe('2 hr 30 min')
    })

    it('returns 0 min for zero', () => {
      expect(formatDuration(0)).toBe('0 min')
    })

    it('returns 0 min for negative', () => {
      expect(formatDuration(-30)).toBe('0 min')
    })

    it('returns 0 min for null', () => {
      expect(formatDuration(null)).toBe('0 min')
    })
  })
})

describe('Time Formatting', () => {
  describe('formatTime12Hour', () => {
    it('converts 24-hour to 12-hour AM', () => {
      expect(formatTime12Hour('09:30')).toBe('9:30 AM')
      expect(formatTime12Hour('00:00')).toBe('12:00 AM')
    })

    it('converts 24-hour to 12-hour PM', () => {
      expect(formatTime12Hour('14:30')).toBe('2:30 PM')
      expect(formatTime12Hour('12:00')).toBe('12:00 PM')
      expect(formatTime12Hour('23:59')).toBe('11:59 PM')
    })

    it('returns empty string for null', () => {
      expect(formatTime12Hour(null)).toBe('')
    })

    it('returns input for invalid format', () => {
      expect(formatTime12Hour('invalid')).toBe('invalid')
    })
  })

  describe('formatTimeRange', () => {
    it('formats time range correctly', () => {
      expect(formatTimeRange('09:00', '17:00')).toBe('9:00 AM - 5:00 PM')
    })

    it('returns empty string if start is missing', () => {
      expect(formatTimeRange(null, '17:00')).toBe('')
    })

    it('returns empty string if end is missing', () => {
      expect(formatTimeRange('09:00', null)).toBe('')
    })
  })
})
