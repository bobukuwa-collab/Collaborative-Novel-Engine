'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const createRoomSchema = z.object({
  genre: z.string().min(1, 'ジャンルを入力してください').max(20),
  max_players: z.coerce.number().int().min(2).max(8),
  char_limit: z.preprocess(
    (v) => (v === '' || v === 'null' || v === '0' ? null : v),
    z.coerce.number().int().min(1).max(1000).nullable(),
  ),
  timer_seconds: z.coerce.number().int().min(10, 'タイマーは10秒以上で設定してください').max(600, 'タイマーは600秒以内で設定してください'),
  turn_order_mode: z.enum(['fixed', 'random']).default('fixed'),
  game_mode: z.enum(['open', 'secret_battle']).default('secret_battle'),
  max_turns: z.coerce.number().int().min(5).max(200).default(48),
})

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

// 曖昧な文字（0/O、1/I/l）を除いた6文字コード
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateJoinCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('')
}

export async function createRoom(_prev: { error: string } | null, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = createRoomSchema.safeParse({
    genre: formData.get('genre'),
    max_players: formData.get('max_players'),
    char_limit: formData.get('char_limit'),
    timer_seconds: formData.get('timer_seconds'),
    turn_order_mode: formData.get('turn_order_mode'),
    game_mode: formData.get('game_mode'),
    max_turns: formData.get('max_turns'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { genre, max_players, char_limit, timer_seconds, turn_order_mode, game_mode, max_turns } = result.data

  // コード衝突時は最大3回リトライ
  let room = null
  for (let i = 0; i < 3; i++) {
    const join_code = generateJoinCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        genre,
        max_players,
        char_limit,
        timer_seconds,
        turn_order_mode,
        game_mode,
        max_turns,
        created_by: user.id,
        join_code,
      })
      .select('id')
      .single()

    if (!error && data) {
      room = data
      break
    }
    // unique違反以外はすぐ返す
    if (error && !error.message.includes('unique')) {
      return { error: `ルームの作成に失敗しました: ${error.message}` }
    }
  }

  if (!room) {
    return { error: 'ルームの作成に失敗しました。もう一度お試しください。' }
  }

  const { error: memberError } = await supabase
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: user.id,
      join_order: 0,
      color: MEMBER_COLORS[0],
    })

  if (memberError) {
    return { error: `ルームへの参加に失敗しました: ${memberError.message}` }
  }

  redirect(`/rooms/${room.id}`)
}

const joinByCodeSchema = z.object({
  code: z.string().min(1, 'ルームコードを入力してください').max(10),
})

export async function joinRoomByCode(_prev: { error: string } | null, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = joinByCodeSchema.safeParse({ code: formData.get('code') })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const code = result.data.code.trim().toUpperCase()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('join_code', code)
    .maybeSingle()

  if (!room) {
    return { error: 'ルームが見つかりません。コードを確認してください。' }
  }

  if (room.status === 'completed') {
    return { error: 'このルームはすでに完結しています。' }
  }

  redirect(`/rooms/${room.id}`)
}

const themeSchema = z.object({
  theme_text: z.string().min(1, 'テーマを入力してください').max(50, '50文字以内で入力してください'),
})

type ThemeState = { error: string; success?: undefined } | { success: boolean; error?: undefined } | null

export async function setTheme(_prev: ThemeState, formData: FormData): Promise<ThemeState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const roomId = formData.get('room_id') as string
  if (!roomId) return { error: 'ルームIDが不正です' }

  const { data: roomRow } = await supabase
    .from('rooms')
    .select('game_mode')
    .eq('id', roomId)
    .maybeSingle()

  if (roomRow?.game_mode === 'secret_battle') {
    return { error: '秘密対戦ルームではテーマは開始時に自動配布されます' }
  }

  const result = themeSchema.safeParse({ theme_text: formData.get('theme_text') })
  if (!result.success) return { error: result.error.issues[0].message }

  const { error } = await supabase
    .from('room_themes')
    .upsert(
      { room_id: roomId, user_id: user.id, theme_text: result.data.theme_text },
      { onConflict: 'room_id,user_id' },
    )

  if (error) return { error: `テーマの設定に失敗しました: ${error.message}` }
  return { success: true }
}
