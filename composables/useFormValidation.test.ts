/**
 * useFormValidation Composable - Unit Tests
 *
 * Tests all validation and formatting logic
 */

import { describe, it, expect } from 'vitest'
import { useFormValidation } from './useFormValidation'

describe('useFormValidation', () => {
  const { formatPlaca, validateEmail, validatePlaca } = useFormValidation()

  describe('formatPlaca', () => {
    it('should convert lowercase to uppercase', () => {
      expect(formatPlaca('abc1d23')).toBe('ABC1D23')
    })

    it('should remove special characters', () => {
      expect(formatPlaca('ABC-1D23')).toBe('ABC1D23')
      expect(formatPlaca('ABC.1D23')).toBe('ABC1D23')
      expect(formatPlaca('ABC 1D23')).toBe('ABC1D23')
    })

    it('should limit to 7 characters', () => {
      expect(formatPlaca('ABC1D2399999')).toBe('ABC1D23')
    })

    it('should handle mixed case and special chars', () => {
      expect(formatPlaca('abc-1d-23')).toBe('ABC1D23')
    })

    it('should handle empty string', () => {
      expect(formatPlaca('')).toBe('')
    })

    it('should remove all non-alphanumeric', () => {
      expect(formatPlaca('!@#ABC$%^1&*D()23')).toBe('ABC1D23')
    })
  })

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co')).toBe(true)
      expect(validateEmail('email+tag@gmail.com')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('test @example.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })

    it('should reject emails without TLD', () => {
      expect(validateEmail('test@domain')).toBe(false)
    })
  })

  describe('validatePlaca', () => {
    describe('Mercosul format (ABC1D23)', () => {
      it('should accept valid Mercosul plates', () => {
        expect(validatePlaca('ABC1D23')).toBe(true)
        expect(validatePlaca('XYZ9Z99')).toBe(true)
      })

      it('should accept with special chars (will be cleaned)', () => {
        expect(validatePlaca('ABC-1D23')).toBe(true)
        expect(validatePlaca('ABC 1D23')).toBe(true)
      })
    })

    describe('Old format (ABC1234)', () => {
      it('should accept valid old format plates', () => {
        expect(validatePlaca('ABC1234')).toBe(true)
        expect(validatePlaca('XYZ9999')).toBe(true)
      })
    })

    describe('Invalid plates', () => {
      it('should reject plates with wrong length', () => {
        expect(validatePlaca('AB1234')).toBe(false) // Too short
        expect(validatePlaca('ABC12345')).toBe(false) // Too long
      })

      it('should reject plates with wrong pattern', () => {
        expect(validatePlaca('1BC1234')).toBe(false) // Starts with number
        expect(validatePlaca('A1C1234')).toBe(false) // Number in second position
        expect(validatePlaca('ABCD123')).toBe(false) // 4 letters
      })

      it('should reject empty or very short inputs', () => {
        expect(validatePlaca('')).toBe(false)
        expect(validatePlaca('A')).toBe(false)
        expect(validatePlaca('AB')).toBe(false)
      })
    })

    describe('Edge cases', () => {
      it('should handle lowercase input', () => {
        expect(validatePlaca('abc1234')).toBe(true)
        expect(validatePlaca('abc1d23')).toBe(true)
      })

      it('should handle mixed case', () => {
        expect(validatePlaca('AbC1234')).toBe(true)
        expect(validatePlaca('XyZ9z99')).toBe(true)
      })
    })
  })
})
