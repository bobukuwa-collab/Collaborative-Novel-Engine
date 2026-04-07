import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabaseクライアントをモック
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

// 'use server' ディレクティブはVitestでは無視されるため直接importできる
// next/navigationもモック
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const { toggleLike } = await import('@/lib/novels/actions')

describe('toggleLike', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await toggleLike('novel-123')
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('いいね済みの場合は削除してliked: falseを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { novel_id: 'novel-123' } }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      }),
    })

    // selectで既存いいねを返し、deleteを実行するシナリオ
    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { novel_id: 'novel-123' } }),
        }
      }
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        }),
      }
    })

    const result = await toggleLike('novel-123')
    expect(result).toEqual({ liked: false })
  })

  it('いいね未済の場合は追加してliked: trueを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }
      }
      return {
        insert: vi.fn().mockResolvedValue({}),
      }
    })

    const result = await toggleLike('novel-123')
    expect(result).toEqual({ liked: true })
  })
})
