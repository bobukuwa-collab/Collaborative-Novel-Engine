import { describe, it, expect } from 'vitest'
import { shouldScoreTurn, THEME_SCORE_INTERVAL } from '@/lib/ai/score-session'

describe('shouldScoreTurn', () => {
  it(`3ターンごと（間隔=${THEME_SCORE_INTERVAL}）に採点`, () => {
    expect(shouldScoreTurn(3, -1)).toBe(true)
    expect(shouldScoreTurn(6, 3)).toBe(true)
    expect(shouldScoreTurn(6, 6)).toBe(false)
    expect(shouldScoreTurn(1, -1)).toBe(false)
  })
})
