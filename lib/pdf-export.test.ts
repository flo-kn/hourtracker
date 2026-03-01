import { describe, it, expect } from 'vitest'
import { formatHoursForPDF } from './pdf-export'

describe('formatHoursForPDF', () => {
  describe('rounding behavior - avoids .5 rounding up', () => {
    it('should NOT round 65.5 to 66 (the January 2026 "ww" customer bug)', () => {
      // This was the exact bug: 65.5 hours was being displayed as "66 h" in the PDF
      // because toFixed(0) rounds .5 up
      const result = formatHoursForPDF(65.5)
      expect(result).toBe('65,50')
      expect(result).not.toBe('66')
    })

    it('should preserve half hours (0.5)', () => {
      expect(formatHoursForPDF(8.5)).toBe('8,50')
      expect(formatHoursForPDF(0.5)).toBe('0,50')
      expect(formatHoursForPDF(100.5)).toBe('100,50')
    })

    it('should preserve quarter hours (0.25, 0.75)', () => {
      expect(formatHoursForPDF(8.25)).toBe('8,25')
      expect(formatHoursForPDF(8.75)).toBe('8,75')
    })
  })

  describe('whole numbers', () => {
    it('should display whole numbers without decimals', () => {
      expect(formatHoursForPDF(65)).toBe('65')
      expect(formatHoursForPDF(0)).toBe('0')
      expect(formatHoursForPDF(100)).toBe('100')
      expect(formatHoursForPDF(8)).toBe('8')
    })
  })

  describe('German locale formatting', () => {
    it('should use comma as decimal separator (German format)', () => {
      expect(formatHoursForPDF(8.5)).toContain(',')
      expect(formatHoursForPDF(8.5)).not.toContain('.')
    })

    it('should show exactly 2 decimal places for non-integers', () => {
      expect(formatHoursForPDF(8.5)).toBe('8,50')
      expect(formatHoursForPDF(8.1)).toBe('8,10')
      expect(formatHoursForPDF(8.12)).toBe('8,12')
    })
  })

  describe('edge cases', () => {
    it('should handle very small decimals', () => {
      expect(formatHoursForPDF(0.01)).toBe('0,01')
      expect(formatHoursForPDF(0.1)).toBe('0,10')
    })

    it('should handle large numbers', () => {
      expect(formatHoursForPDF(1000)).toBe('1000')
      expect(formatHoursForPDF(1000.5)).toBe('1000,50')
    })
  })
})
