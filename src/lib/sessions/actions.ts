'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

function nextTimerEnd(durationSeconds: number): string {
  return new Date(Date.now() + durationSeconds * 1000).toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function startSession(roomId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('room_members')
    .select('join_order')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.join_order !== 0) return

  // 既にセッションが存在する場合はスキップ（二重送信防止）
  const { data: existingSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', roomId)
    .limit(1)
    .maybeSingle()

  if (existingSession) return

  // ルームのタイマー設定を取得
  const { data: room } = await supabase
    .from('rooms')
    .select('timer_seconds')
    .eq('id', roomId)
    .single()

  const timerSeconds = room?.timer_seconds ?? 60

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({ room_id: roomId, current_turn: 0, timer_end: nextTimerEnd(timerSeconds) })

  if (sessionError) return

  await supabase
    .from('rooms')
    .update({ status: 'in_progress' })
    .eq('id', roomId)

  redirect(`/rooms/${roomId}`)
}

const submitSchema = z.object({
  content: z.string().min(1, '1文字以上入力してください'),
})

export async function submitSentence(
  sessionId: string,
  content: string,
  currentTurn: number,
  charLimit: number,
  timerSeconds: number,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = submitSchema.safeParse({ content })
  if (!result.success) return { error: result.error.issues[0].message }

  if (content.length > charLimit) {
    return { error: `${charLimit}文字以内で入力してください` }
  }

  const { count } = await supabase
    .from('sentences')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const seq = (count ?? 0) + 1

  const { error: sentenceError } = await supabase
    .from('sentences')
    .insert({ session_id: sessionId, user_id: user.id, content, seq })

  if (sentenceError) {
    return { error: `投稿に失敗しました: ${sentenceError.message}` }
  }

  const { error: sessionError } = await supabase
    .from('sessions')
    .update({ current_turn: currentTurn + 1, timer_end: nextTimerEnd(timerSeconds) })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  if (sessionError) {
    return { error: `ターン更新に失敗しました: ${sessionError.message}` }
  }

  return { success: true }
}

export async function skipTurn(sessionId: string, currentTurn: number, timerSeconds: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  await supabase
    .from('sessions')
    .update({ current_turn: currentTurn + 1, timer_end: nextTimerEnd(timerSeconds) })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  return { success: true }
}

// 完結処理の共通ロジック（voteToEndから呼ぶ）
async function completeNovel(roomId: string) {
  const supabase = createClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('genre')
    .eq('id', roomId)
    .single()

  const title = room ? `${room.genre}の言葉` : '無題の言葉'

  const { data: novel, error: novelError } = await supabase
    .from('novels')
    .insert({
      room_id: roomId,
      title,
      status: 'completed',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (novelError || !novel) {
    return { error: `小説の保存に失敗しました: ${novelError?.message}` }
  }

  await supabase
    .from('rooms')
    .update({ status: 'completed' })
    .eq('id', roomId)

  return { novelId: novel.id }
}

export async function voteToEnd(roomId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  // 既に投票済みか確認
  const { data: existing } = await supabase
    .from('completion_votes')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'すでに投票済みです' }

  // 投票を追加
  const { error: voteError } = await supabase
    .from('completion_votes')
    .insert({ room_id: roomId, user_id: user.id })

  if (voteError) return { error: `投票に失敗しました: ${voteError.message}` }

  // 投票数と参加人数を取得
  const [{ count: voteCount }, { count: memberCount }] = await Promise.all([
    supabase
      .from('completion_votes')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId),
    supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId),
  ])

  const votes = voteCount ?? 0
  const members = memberCount ?? 1

  // 過半数チェック（2人の場合は全員、3人以上は過半数）
  const threshold = members === 2 ? 2 : Math.floor(members / 2) + 1
  if (votes >= threshold) {
    const result = await completeNovel(roomId)
    if (result.error) return { error: result.error }
    redirect(`/novels/${result.novelId}`)
  }

  return { success: true, votes, members, threshold }
}
