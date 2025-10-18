import { describe, it, expect } from 'vitest'
import { normalizeColor, validateColorOrDefault } from '../colors'

describe('normalizeColor', () => {
  describe('hex colors', () => {
    it('accepts 6-digit hex colors', () => {
      expect(normalizeColor('#FF0000')).toBe('#FF0000')
      expect(normalizeColor('#123456')).toBe('#123456')
      expect(normalizeColor('#abcdef')).toBe('#ABCDEF')
    })

    it('expands 3-digit hex colors to 6-digit format', () => {
      expect(normalizeColor('#F00')).toBe('#FF0000')
      expect(normalizeColor('#0F0')).toBe('#00FF00')
      expect(normalizeColor('#00F')).toBe('#0000FF')
      expect(normalizeColor('#ABC')).toBe('#AABBCC')
    })

    it('normalizes hex colors to uppercase', () => {
      expect(normalizeColor('#ff0000')).toBe('#FF0000')
      expect(normalizeColor('#aabbcc')).toBe('#AABBCC')
    })

    it('trims whitespace from hex colors', () => {
      expect(normalizeColor('  #FF0000  ')).toBe('#FF0000')
      expect(normalizeColor('\t#123\n')).toBe('#112233')
    })
  })

  describe('named colors', () => {
    it('converts basic color names to hex', () => {
      expect(normalizeColor('red')).toBe('#FF0000')
      expect(normalizeColor('green')).toBe('#008000')
      expect(normalizeColor('blue')).toBe('#0000FF')
      expect(normalizeColor('white')).toBe('#FFFFFF')
      expect(normalizeColor('black')).toBe('#000000')
    })

    it('converts extended color names to hex', () => {
      expect(normalizeColor('coral')).toBe('#FF7F50')
      expect(normalizeColor('crimson')).toBe('#DC143C')
      expect(normalizeColor('turquoise')).toBe('#40E0D0')
      expect(normalizeColor('lavender')).toBe('#E6E6FA')
    })

    it('is case-insensitive for named colors', () => {
      expect(normalizeColor('RED')).toBe('#FF0000')
      expect(normalizeColor('Red')).toBe('#FF0000')
      expect(normalizeColor('rED')).toBe('#FF0000')
      expect(normalizeColor('CORAL')).toBe('#FF7F50')
    })

    it('trims whitespace from named colors', () => {
      expect(normalizeColor('  red  ')).toBe('#FF0000')
      expect(normalizeColor('\tblue\n')).toBe('#0000FF')
    })

    it('handles both gray and grey spellings', () => {
      expect(normalizeColor('gray')).toBe('#808080')
      expect(normalizeColor('grey')).toBe('#808080')
      expect(normalizeColor('darkgray')).toBe('#A9A9A9')
      expect(normalizeColor('darkgrey')).toBe('#A9A9A9')
    })
  })

  describe('invalid input', () => {
    it('returns null for invalid hex colors', () => {
      expect(normalizeColor('#GGGGGG')).toBeNull()
      expect(normalizeColor('#12345')).toBeNull()
      expect(normalizeColor('#1234567')).toBeNull()
      expect(normalizeColor('123456')).toBeNull()
      expect(normalizeColor('#')).toBeNull()
    })

    it('returns null for invalid color names', () => {
      expect(normalizeColor('nope')).toBeNull()
      expect(normalizeColor('invalid')).toBeNull()
      expect(normalizeColor('redd')).toBeNull()
      expect(normalizeColor('blueish')).toBeNull()
    })

    it('returns null for non-string input', () => {
      expect(normalizeColor(null)).toBeNull()
      expect(normalizeColor(undefined)).toBeNull()
      expect(normalizeColor(123)).toBeNull()
      expect(normalizeColor({})).toBeNull()
      expect(normalizeColor([])).toBeNull()
    })

    it('returns null for empty strings', () => {
      expect(normalizeColor('')).toBeNull()
      expect(normalizeColor('   ')).toBeNull()
      expect(normalizeColor('\t\n')).toBeNull()
    })
  })
})

describe('validateColorOrDefault', () => {
  it('returns normalized color for valid input', () => {
    expect(validateColorOrDefault('red', '#000000')).toBe('#FF0000')
    expect(validateColorOrDefault('#123456', '#000000')).toBe('#123456')
    expect(validateColorOrDefault('#F00', '#000000')).toBe('#FF0000')
  })

  it('returns fallback for invalid input', () => {
    expect(validateColorOrDefault('invalid', '#123456')).toBe('#123456')
    expect(validateColorOrDefault('nope', '#ABCDEF')).toBe('#ABCDEF')
    expect(validateColorOrDefault(null, '#FFFFFF')).toBe('#FFFFFF')
    expect(validateColorOrDefault('', '#000000')).toBe('#000000')
  })

  it('preserves fallback color as-is', () => {
    expect(validateColorOrDefault('invalid', '#lowercase')).toBe('#lowercase')
    expect(validateColorOrDefault('invalid', 'fallback')).toBe('fallback')
  })
})

