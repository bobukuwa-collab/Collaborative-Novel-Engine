import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { assignThemesForMembers } from '@/lib/ai/assign-themes'

const FAKE_UUIDS = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
]

describe('assignThemesForMembers（deterministicFallback）', () => {
  beforeAll(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('参加者ゼロのとき空配列を返す', async () => {
    const result = await assignThemesForMembers('SF', [])
    expect(result).toHaveLength(0)
  })

  it('1人の場合テーマを1件返す', async () => {
    const result = await assignThemesForMembers('SF', [FAKE_UUIDS[0]!])
    expect(result).toHaveLength(1)
    expect(result[0]!.user_id).toBe(FAKE_UUIDS[0])
    expect(result[0]!.theme_text.length).toBeGreaterThan(0)
  })

  it('複数人のとき人数分のテーマを返す', async () => {
    const result = await assignThemesForMembers('ファンタジー', FAKE_UUIDS)
    expect(result).toHaveLength(FAKE_UUIDS.length)
  })

  it('同じ入力なら毎回同じ結果（決定論的）', async () => {
    const a = await assignThemesForMembers('SF', FAKE_UUIDS)
    const b = await assignThemesForMembers('SF', FAKE_UUIDS)
    expect(a.map((r) => r.theme_text)).toEqual(b.map((r) => r.theme_text))
  })

  it('テーマは50文字以内', async () => {
    const result = await assignThemesForMembers('ランダム', FAKE_UUIDS)
    result.forEach((r) => {
      expect(r.theme_text.length).toBeLessThanOrEqual(50)
    })
  })

  it('全員のuser_idが含まれる', async () => {
    const result = await assignThemesForMembers('SFアクション', FAKE_UUIDS)
    const returnedIds = result.map((r) => r.user_id)
    FAKE_UUIDS.forEach((uid) => {
      expect(returnedIds).toContain(uid)
    })
  })
})
