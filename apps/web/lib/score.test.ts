import { describe, expect, test } from 'bun:test'
import type { ISiteReport } from '@isreadyai/scanner'
import { aiSearchScore, combinedScore, deepTrackScore } from './score'

describe('aiSearchScore', () => {
  test('uses the single-page base when no deep scan ran', () => {
    expect(aiSearchScore({ base: 92 })).toBe(92)
  })
  test('uses the site-wide deep score over base — never both (no double-count)', () => {
    expect(aiSearchScore({ base: 92, deep: 45 })).toBe(45)
  })
})

describe('deepTrackScore', () => {
  test('uses scanSite overall as the canonical deep score', () => {
    const site = {
      overall: 80,
      primary: { overall: 88 },
      pages: [{ overall: 20 }],
    } as ISiteReport

    expect(deepTrackScore(site)).toBe(80)
  })
})

describe('combinedScore', () => {
  test('base only → AI Search alone', () => {
    expect(combinedScore({ base: 92 })).toBe(92)
  })
  test('deep, no agent → site-wide AI Search alone (base not averaged in)', () => {
    expect(combinedScore({ base: 92, deep: 45 })).toBe(45)
  })
  test('deep + agent → mean of the two tracks (homepage not double-counted)', () => {
    // The old bug averaged base+deep+smart: mean(92, 45, 94) = 77.
    // Correct: AI Search (deep) 45 with AI Agent 94 → mean = 70.
    expect(combinedScore({ base: 92, deep: 45, smart: 94 })).toBe(70)
  })
  test('base + agent, no deep → mean of base and agent', () => {
    expect(combinedScore({ base: 92, smart: 80 })).toBe(86)
  })
})
