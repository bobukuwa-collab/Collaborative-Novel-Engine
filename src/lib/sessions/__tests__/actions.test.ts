import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'room_themes') {
        return {
          select: () => ({
            eq: () => ({ data: [] as { user_id: string; theme_text: string }[] }),
          }),
        }
      }
      if (table === 'session_theme_scores') {
        return {
          upsert: async () => ({ error: null }),
        }
      }
      return { select: () => ({ eq: () => ({ data: [] }) }) }
    },
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const { skipTurn, voteToEnd } = await import('@/lib/sessions/actions')

function mockSessionsForSkip(currentTurn: number) {
  const sessionData = {
    current_turn: currentTurn,
    max_turns: 100,
    room_id: 'room-a',
    last_scored_turn: -1,
    end_proposed: false,
  }
  const single = vi.fn().mockResolvedValue({ data: sessionData })
  const innerEq = vi.fn().mockResolvedValue({ error: null })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'sessions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: innerEq }) }),
      }
    }
    if (table === 'sentences') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [] as { content: string }[] }),
          }),
        }),
      }
    }
    return {}
  })
}

describe('skipTurn', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const result = await skipTurn('session-1', 0, 60)
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('認証済みの場合はsuccess: trueを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSessionsForSkip(2)
    const result = await skipTurn('session-1', 2, 60)
    expect(result).toEqual({ success: true })
  })

  it('current_turn + 1 でDBを更新する', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSessionsForSkip(3)
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  current_turn: 3,
                  max_turns: 100,
                  room_id: 'room-a',
                  last_scored_turn: -1,
                  end_proposed: false,
                },
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'sentences') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }
      }
      return {}
    })

    await skipTurn('session-1', 3, 60)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ current_turn: 4 }))
  })

  it('最大ターン到達後はエラー', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  current_turn: 50,
                  max_turns: 50,
                  room_id: 'room-a',
                  last_scored_turn: -1,
                  end_proposed: false,
                },
              }),
            }),
          }),
        }
      }
      return {}
    })
    const result = await skipTurn('session-1', 50, 60)
    expect(result?.error).toMatch(/最大ターン/)
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
