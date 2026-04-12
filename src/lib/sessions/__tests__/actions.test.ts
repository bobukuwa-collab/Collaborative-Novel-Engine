import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const { skipTurn, voteToEnd } = await import('@/lib/sessions/actions')

describe('skipTurn', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const result = await skipTurn('session-1', 0, 60)
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('認証済みの場合はsuccess: trueを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // 1回目: sessions.select（セッション取得）
    // 2回目: sessions.update（ターン更新）
    mockSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { current_turn: 2, max_turns: 48, room_id: 'room-1', last_scored_turn: -1, end_proposed: false },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      })
      // AI スコアリングで追加の from() 呼び出しが来る場合の fallback
      .mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      })
    const result = await skipTurn('session-1', 2, 60)
    expect(result).toEqual({ success: true })
  })

  it('current_turn + 1 でDBを更新する', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })
    mockSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { current_turn: 3, max_turns: 48, room_id: 'room-1', last_scored_turn: -1, end_proposed: false },
          error: null,
        }),
      })
      .mockReturnValueOnce({ update: mockUpdate })
      .mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      })

    await skipTurn('session-1', 3, 60)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ current_turn: 4 }))
  })
})

describe('voteToEnd', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const result = await voteToEnd('room-1')
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('既に投票済みの場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' } }),
    })
    const result = await voteToEnd('room-1')
    expect(result).toEqual({ error: 'すでに投票済みです' })
  })
})
