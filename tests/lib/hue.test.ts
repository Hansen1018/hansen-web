import { describe, expect, it } from 'vitest'
import { hashHue } from '@/lib/hue'

describe('hashHue', () => {
  it('is deterministic and always returns a valid CSS hue', () => {
    const samples = ['', 'React', 'Vue', 'a'.repeat(1_000), '深圳 🚀']

    for (const sample of samples) {
      const hue = hashHue(sample)
      expect(hashHue(sample)).toBe(hue)
      expect(Number.isInteger(hue)).toBe(true)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })
})
