import { describe, expect, test } from 'bun:test'
import { EPageBannerSeverity, ESectionMessageSeverity } from '@/components/ui/severity'

describe('severity', () => {
  test('exposes the shared severity keys', () => {
    expect(EPageBannerSeverity).toEqual({
      INFO: 'info',
      WARNING: 'warning',
      CRITICAL: 'critical',
      SUCCESS: 'success',
    })
    expect(ESectionMessageSeverity).toBe(EPageBannerSeverity)
  })

  /** Server Components read these values directly, so this module must never become a client module. */
  test('stays directive-free so Server Components can read it', async () => {
    const source = await Bun.file(new URL('./severity.ts', import.meta.url)).text()
    expect(source).not.toMatch(/^\s*['"]use client['"]/)
  })
})
