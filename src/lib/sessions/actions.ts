'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignThemesForMembers } from '@/lib/ai/assign-themes'
import { scoreSessionText, shouldScoreTurn } from '@/lib/ai/score-session'
import { generateBattleVerdict } from '@/lib/ai/battle-verdict'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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

  if (!member || member.join_order !== 0) {
    redirect(`/rooms/${roomId}?startError=${encodeURIComponent('ホストのみ開始できます')}`)
  }

  const { data: existingSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', roomId)
    .limit(1)
    .maybeSingle()

  if (existingSession) redirect(`/rooms/${roomId}`)

  const { data: room } = await supabase
    .from('rooms')
    .select('timer_seconds, game_mode, max_turns, genre')
    .eq('id', roomId)
    .single()

  if (!room) {
    redirect(`/rooms/${roomId}?startError=${encodeURIComponent('ルーム情報の取得に失敗しました')}`)
  }

  const timerSeconds = room.timer_seconds ?? 60
  const maxTurns = room.max_turns ?? 48
  const gameMode = room.game_mode ?? 'open'

  if (gameMode === 'secret_battle') {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      redirect(`/rooms/${roomId}?startError=${encodeURIComponent('秘密対戦にはサーバに SUPABASE_SERVICE_ROLE_KEY を設定してください')}`)
    }
    try {
      const admin = createAdminClient()
      const { data: mems, error: memErr } = await admin
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .order('join_order', { ascending: true })
      if (memErr || !mems?.length) {
        redirect(`/rooms/${roomId}?startError=${encodeURIComponent('参加者情報の取得に失敗しました')}`)
      }
      const userIds = mems.map((m) => m.user_id)
      const assigned = await assignThemesForMembers(room.genre ?? 'ランダム', userIds, roomId)
      for (const row of assigned) {
        const { error: upErr } = await admin
          .from('room_themes')
          .upsert(
            { room_id: roomId, user_id: row.user_id, theme_text: row.theme_text },
            { onConflict: 'room_id,user_id' },
          )
        if (upErr) {
          redirect(`/rooms/${roomId}?startError=${encodeURIComponent(`テーマ配布に失敗: ${upErr.message}`)}`)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'テーマ配布エラー'
      redirect(`/rooms/${roomId}?startError=${encodeURIComponent(msg)}`)
    }
  }

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      room_id: roomId,
      current_turn: 0,
      timer_end: nextTimerEnd(timerSeconds),
      max_turns: maxTurns,
    })

  if (sessionError) {
    redirect(`/rooms/${roomId}?startError=${encodeURIComponent(`セッション作成に失敗しました: ${sessionError.message}`)}`)
  }

  await supabase
    .from('rooms')
    .update({ status: 'in_progress' })
    .eq('id', roomId)

  redirect(`/rooms/${roomId}`)
}

const submitSchema = z.object({
  content: z.string().min(1, '1文字以上入力してください'),
})

async function maybeScoreAndProposeEnd(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  roomId: string,
  newTurn: number,
  lastScoredTurn: number,
  prevEndProposed: boolean,
  maxTurns: number,
) {
  let nextLastScored = lastScoredTurn
  let coherence: number | null = null
  let mainThemeScore: number | null = null
  const scores: Record<string, number> = {}

  if (shouldScoreTurn(newTurn, lastScoredTurn)) {
    let themes: { user_id: string; theme_text: string }[] = []
    try {
      const admin = createAdminClient()
      const { data: th } = await admin
        .from('room_themes')
        .select('user_id, theme_text')
        .eq('room_id', roomId)
      themes = th ?? []
    } catch {
      const { data: th } = await supabase
        .from('room_themes')
        .select('user_id, theme_text')
        .eq('room_id', roomId)
      themes = th ?? []
    }

    const { data: sents } = await supabase
      .from('sentences')
      .select('content')
      .eq('session_id', sessionId)
      .order('seq', { ascending: true })

    const storyText = (sents ?? []).map((s) => s.content).join('\n')
    const { data: roomData } = await supabase.from('rooms').select('genre').eq('id', roomId).single()
    const result = await scoreSessionText({ storyText, themes, mainTheme: roomData?.genre ?? '' })
    Object.assign(scores, result.scores)
    coherence = result.coherence
    mainThemeScore = result.mainThemeScore
    nextLastScored = newTurn
  }

  const strongEnough = coherence !== null && coherence >= 68
  const dominant =
    Object.keys(scores).length > 0 &&
    Object.values(scores).some((v) => v >= 72)
  const endProposed =
    prevEndProposed || newTurn >= maxTurns || strongEnough || dominant

  const patch: Record<string, unknown> = {}
  if (endProposed) patch.end_proposed = true
  if (nextLastScored !== lastScoredTurn) {
    patch.coherence_score = coherence
    patch.last_scored_turn = nextLastScored
    if (mainThemeScore !== null) patch.main_theme_score = mainThemeScore
    try {
      const admin = createAdminClient()
      for (const [uid, val] of Object.entries(scores)) {
        await admin.from('session_theme_scores').upsert(
          { session_id: sessionId, user_id: uid, score: val },
          { onConflict: 'session_id,user_id' },
        )
      }
    } catch {
      /* スコア行の保存のみスキップ（SERVICE_ROLE 未設定時など） */
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from('sessions').update(patch).eq('id', sessionId)
  }
}

const HIDDEN_MAX_CHARS = 1000

export async function submitSentence(
  sessionId: string,
  content: string,
  currentTurn: number,
  charLimit: number | null,
  timerSeconds: number,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = submitSchema.safeParse({ content })
  if (!result.success) return { error: result.error.issues[0].message }

  const effectiveLimit = charLimit ?? HIDDEN_MAX_CHARS
  if (content.length > effectiveLimit) {
    return { error: `${effectiveLimit}文字以内で入力してください` }
  }

  const { data: sessRow, error: sessErr } = await supabase
    .from('sessions')
    .select('current_turn, max_turns, room_id, last_scored_turn, end_proposed')
    .eq('id', sessionId)
    .single()

  if (sessErr || !sessRow) {
    return { error: 'セッションが見つかりません' }
  }
  if (sessRow.current_turn !== currentTurn) {
    return { error: 'ターンが更新されました。画面を更新してください。' }
  }
  if (sessRow.current_turn >= sessRow.max_turns) {
    return { error: '最大ターンに達しています。完結に投票してください。' }
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

  const newTurn = currentTurn + 1
  await maybeScoreAndProposeEnd(
    supabase,
    sessionId,
    sessRow.room_id,
    newTurn,
    sessRow.last_scored_turn ?? -1,
    sessRow.end_proposed ?? false,
    sessRow.max_turns,
  )

  return { success: true }
}

export async function skipTurn(sessionId: string, currentTurn: number, timerSeconds: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { data: sessRow, error: sessErr } = await supabase
    .from('sessions')
    .select('current_turn, max_turns, room_id, last_scored_turn, end_proposed')
    .eq('id', sessionId)
    .single()

  if (sessErr || !sessRow) {
    return { error: 'セッションが見つかりません' }
  }
  if (sessRow.current_turn !== currentTurn) {
    return { error: 'ターンが更新されました。画面を更新してください。' }
  }
  if (sessRow.current_turn >= sessRow.max_turns) {
    return { error: '最大ターンに達しています。完結に投票してください。' }
  }

  const { error: upErr } = await supabase
    .from('sessions')
    .update({ current_turn: currentTurn + 1, timer_end: nextTimerEnd(timerSeconds) })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  if (upErr) {
    return { error: `ターン更新に失敗しました: ${upErr.message}` }
  }

  const newTurn = currentTurn + 1
  await maybeScoreAndProposeEnd(
    supabase,
    sessionId,
    sessRow.room_id,
    newTurn,
    sessRow.last_scored_turn ?? -1,
    sessRow.end_proposed ?? false,
    sessRow.max_turns,
  )

  return { success: true }
}

// 完結処理の共通ロジック（voteToEndから呼ぶ）
async function completeNovel(roomId: string) {
  const supabase = createClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('genre, game_mode')
    .eq('id', roomId)
    .single()

  const title = room ? `${room.genre}の物語` : '無題の物語'

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
    return { error: `作品の保存に失敗しました: ${novelError?.message}` }
  }

  // バトル判定解説を生成
  if (room?.game_mode === 'secret_battle') {
    try {
      const verdict = await buildBattleVerdict(supabase, roomId, room.genre ?? '')
      if (verdict) {
        await supabase.from('novels').update({ battle_verdict: verdict }).eq('id', novel.id)
      }
    } catch { /* 解説生成失敗は無視して完結処理を続行 */ }
  }

  await supabase
    .from('rooms')
    .update({ status: 'completed' })
    .eq('id', roomId)

  revalidatePath('/library')
  revalidatePath(`/novels/${novel.id}`)

  return { novelId: novel.id }
}

async function buildBattleVerdict(
  supabase: ReturnType<typeof createClient>,
  roomId: string,
  genre: string,
): Promise<string | null> {
  const { data: session } = await supabase
    .from('sessions').select('id').eq('room_id', roomId)
    .order('created_at', { ascending: false }).limit(1).single()
  if (!session) return null

  const [scoresRes, themesRes, sentencesRes, membersRes] = await Promise.all([
    supabase.from('session_theme_scores').select('user_id, score').eq('session_id', session.id),
    supabase.from('room_themes').select('user_id, theme_text').eq('room_id', roomId),
    supabase.from('sentences').select('content').eq('session_id', session.id).order('seq', { ascending: true }),
    supabase.from('room_members').select('user_id, users(display_name)').eq('room_id', roomId),
  ])

  const themeScores = scoresRes.data ?? []
  if (themeScores.length === 0) return null

  const themes = themesRes.data ?? []
  const storyText = (sentencesRes.data ?? []).map((s: { content: string }) => s.content).join('\n')
  const members = membersRes.data ?? []

  const players = themeScores.map((s: { user_id: string; score: number }) => {
    const m = members.find((mb: { user_id: string }) => mb.user_id === s.user_id)
    const usersField = m?.users
    const displayName = Array.isArray(usersField)
      ? (usersField[0] as { display_name?: string })?.display_name
      : (usersField as unknown as { display_name?: string } | null)?.display_name
    const name = displayName ?? '不明'
    const theme = themes.find((t: { user_id: string; theme_text: string }) => t.user_id === s.user_id)?.theme_text ?? ''
    return { name, theme, score: s.score }
  })

  const winner = players.reduce((a, b) => (a.score >= b.score ? a : b))
  return generateBattleVerdict({ storyText, genre, players, winnerName: winner.name })
}

export async function voteToEnd(roomId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { data: existing } = await supabase
    .from('completion_votes')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'すでに投票済みです' }

  const { error: voteError } = await supabase
    .from('completion_votes')
    .insert({ room_id: roomId, user_id: user.id })

  if (voteError) return { error: `投票に失敗しました: ${voteError.message}` }

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

  const threshold = members === 2 ? 2 : Math.floor(members / 2) + 1
  if (votes >= threshold) {
    const result = await completeNovel(roomId)
    if (result.error) return { error: result.error }
    redirect(`/novels/${result.novelId}`)
  }

  return { success: true, votes, members, threshold }
}
