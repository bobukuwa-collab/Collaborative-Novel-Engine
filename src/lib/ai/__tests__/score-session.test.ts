import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { shouldScoreTurn, THEME_SCORE_INTERVAL, scoreSessionText } from '@/lib/ai/score-session'

describe('shouldScoreTurn', () => {
  it(`3ターンごと（間隔=${THEME_SCORE_INTERVAL}）に採点`, () => {
    expect(shouldScoreTurn(3, -1)).toBe(true)
    expect(shouldScoreTurn(6, 3)).toBe(true)
    expect(shouldScoreTurn(6, 6)).toBe(false)
    expect(shouldScoreTurn(1, -1)).toBe(false)
  })

  it('ターン0は採点しない', () => {
    expect(shouldScoreTurn(0, -1)).toBe(false)
  })

  it('同じターンを二度採点しない', () => {
    expect(shouldScoreTurn(3, 3)).toBe(false)
    expect(shouldScoreTurn(6, 6)).toBe(false)
  })

  it('採点済みより大きい次の節目で採点する', () => {
    expect(shouldScoreTurn(9, 6)).toBe(true)
  })
})

describe('scoreSessionText（heuristic fallback）', () => {
  beforeAll(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('テーマキーワードを含む本文はスコアが上がる', async () => {
    const themes = [{ user_id: 'u1', theme_text: '孤独な旅人' }]
    const result = await scoreSessionText({ storyText: '孤独な旅人が雨に打たれて歩いた。', themes })
    expect(result.scores['u1']).toBeGreaterThan(0)
    expect(result.coherence).toBeGreaterThanOrEqual(0)
  })

  it('テーマキーワードが全くない本文はスコアが低い', async () => {
    const themes = [{ user_id: 'u1', theme_text: '宇宙人の侵略' }]
    const result = await scoreSessionText({ storyText: '春の桜が舞い散る。', themes })
    expect(result.scores['u1']).toBeLessThan(30)
  })

  it('空の本文はスコアが全部0', async () => {
    const themes = [{ user_id: 'u1', theme_text: '夏の海辺' }]
    const result = await scoreSessionText({ storyText: '', themes })
    expect(result.scores['u1']).toBe(0)
    expect(result.coherence).toBe(0)
  })

  it('テーマが空のときはスコアが空オブジェクト', async () => {
    const result = await scoreSessionText({ storyText: '何かが起きた。', themes: [] })
    expect(Object.keys(result.scores)).toHaveLength(0)
    expect(result.coherence).toBe(0)
  })

  it('複数プレイヤーのスコアをそれぞれ返す', async () => {
    const themes = [
      { user_id: 'u1', theme_text: '失われた記憶' },
      { user_id: 'u2', theme_text: '海の向こう' },
    ]
    const result = await scoreSessionText({
      storyText: '失われた記憶が波のように押し寄せた。',
      themes,
    })
    expect('u1' in result.scores).toBe(true)
    expect('u2' in result.scores).toBe(true)
    expect(result.scores['u1']).toBeGreaterThanOrEqual(result.scores['u2']!)
  })

  it('スコアは 0〜100 の範囲に収まる', async () => {
    const themes = [{ user_id: 'u1', theme_text: '孤独 孤独 孤独 孤独 孤独' }]
    const result = await scoreSessionText({
      storyText: '孤独 孤独 孤独 孤独 孤独 孤独 孤独 孤独',
      themes,
    })
    expect(result.scores['u1']).toBeGreaterThanOrEqual(0)
    expect(result.scores['u1']).toBeLessThanOrEqual(100)
  })
})
