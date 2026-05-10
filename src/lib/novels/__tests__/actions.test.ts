import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

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

    // 呼び出し順: 1=novels(published確認), 2=likes(既存確認), 3=likes(delete)
    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // novels: 公開済み確認
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'novel-123' } }),
        }
      }
      if (callCount === 2) {
        // likes: 既存いいね確認
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { novel_id: 'novel-123' } }),
        }
      }
      // likes: delete
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

    // 呼び出し順: 1=novels(published確認), 2=likes(既存確認→null), 3=likes(insert)
    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // novels: 公開済み確認
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'novel-123' } }),
        }
      }
      if (callCount === 2) {
        // likes: 既存いいねなし
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }
      }
      // likes: insert
      return {
        insert: vi.fn().mockResolvedValue({}),
      }
    })

    const result = await toggleLike('novel-123')
    expect(result).toEqual({ liked: true })
  })

  it('存在しない作品へのいいねはエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })

    const result = await toggleLike('nonexistent')
    expect(result).toEqual({ error: '作品が見つかりません' })
  })
})
