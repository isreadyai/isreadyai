import { describe, expect, test } from 'bun:test'
import { emailShell } from '@/lib/email'

describe('emailShell', () => {
  test('declares light and dark and keeps the dark inline brand', () => {
    const html = emailShell('<p class="ir-muted" style="color:#9a9a92">Hello</p>')
    expect(html).toContain('name="color-scheme" content="light dark"')
    expect(html).toContain('name="supported-color-schemes" content="light dark"')
    expect(html).toContain('color-scheme: light dark')
    expect(html).toContain('@media (prefers-color-scheme: light)')
    expect(html).toContain('background-color:#161613')
    expect(html).toContain('#f3f3ee')
    expect(html).toContain('@media only screen and (max-width: 600px)')
    expect(html).toContain('Hello')
  })
})
