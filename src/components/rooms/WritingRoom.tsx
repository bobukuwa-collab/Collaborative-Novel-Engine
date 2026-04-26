'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitSentence, skipTurn, voteToEnd } from '@/lib/sessions/actions'

// Web Speech API の型定義
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

type Session = {
  id: string
  room_id: string
  current_turn: number
  timer_end: string
  max_turns?: number
  coherence_score?: number | null
  end_proposed?: boolean
  last_scored_turn?: number
}

type Sentence = {
  id: string
  session_id: string
  user_id: string
  content: string
  seq: number
  created_at: string
}

type Member = {
  user_id: string
  join_order: number
  color: string
  users: { display_name: string } | null
}

type Theme = {
  user_id: string
  theme_text: string
}

const HIDDEN_MAX_CHARS = 1000

type Room = {
  id: string
  genre: string
  char_limit: number | null
  timer_seconds: number
  turn_order_mode: string
  game_mode: string
  max_turns: number
  mode: string
}

type Props = {
  room: Room
  session: Session
  members: Member[]
  initialSentences: Sentence[]
  currentUserId: string
  initialVoteCount: number
  myVoted: boolean
  initialThemes: Theme[]
  initialMyThemeScore: number | null
}

/**
 * セッションIDをシードとした決定論的シャッフル。
 * 全クライアントが同じ乱数列を生成するので DB 保存不要。
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 2654435761) | 0
  }
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822519) | 0
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917) | 0
    hash = (hash ^ (hash >>> 16)) >>> 0
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function WritingRoom({
  room,
  session: initialSession,
  members,
  initialSentences,
  currentUserId,
  initialVoteCount,
  myVoted: initialMyVoted,
  initialThemes,
  initialMyThemeScore,
}: Props) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [sentences, setSentences] = useState(initialSentences)
  const [themes, setThemes] = useState<Theme[]>(initialThemes)
  const [myThemeScore, setMyThemeScore] = useState<number | null>(initialMyThemeScore)
  const [content, setContent] = useState('')
  const [timeLeft, setTimeLeft] = useState(room.timer_seconds)
  const [error, setError] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(initialVoteCount)
  const [myVoted, setMyVoted] = useState(initialMyVoted)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isVoting, startVoteTransition] = useTransition()
  const skipCalledRef = useRef(false)
  const contentRef = useRef(content)
  useEffect(() => { contentRef.current = content }, [content])

  const effectiveCharLimit = room.char_limit ?? HIDDEN_MAX_CHARS

  // 音声入力
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
      return
    }
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[e.resultIndex][0].transcript
      setContent((prev) => (prev + transcript).slice(0, effectiveCharLimit))
      setSpeechError(null)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setSpeechError(e.error === 'not-allowed' ? 'マイクの使用が許可されていません' : `音声認識エラー: ${e.error}`)
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setSpeechError(null)
  }, [isListening, stopListening, effectiveCharLimit])

  // ターン順を決定（random モードはセッションIDをシードにシャッフル）
  const sortedMembers = [...members].sort((a, b) => a.join_order - b.join_order)
  const orderedMembers = room.turn_order_mode === 'random'
    ? seededShuffle(sortedMembers, session.id)
    : sortedMembers
  const memberCount = orderedMembers.length
  const threshold = memberCount === 2 ? 2 : Math.floor(memberCount / 2) + 1
  const maxTurnCap = session.max_turns ?? room.max_turns
  const turnLocked = session.current_turn >= maxTurnCap
  const currentMemberIndex = session.current_turn % memberCount
  const currentMember = orderedMembers[currentMemberIndex]
  const isMyTurn = currentMember?.user_id === currentUserId
  const isSecret = room.game_mode === 'secret_battle'
  const myThemeRow = themes.find((t) => t.user_id === currentUserId)
  const currentWritersTheme = themes.find((t) => t.user_id === currentMember?.user_id)
  const themeLineForIndicator = isSecret
    ? (isMyTurn ? myThemeRow?.theme_text : undefined)
    : currentWritersTheme?.theme_text

  // ターン切り替え時に音声認識を停止
  useEffect(() => {
    if (!isMyTurn) stopListening()
  }, [isMyTurn, stopListening])

  // 周回数・ターン数
  const roundNumber = Math.floor(session.current_turn / memberCount) + 1
  const turnInRound = (session.current_turn % memberCount) + 1

  useEffect(() => {
    skipCalledRef.current = false
    setError(null)
  }, [session.current_turn])

  // タイマーカウントダウン
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(session.timer_end).getTime() - Date.now()) / 1000),
      )
      setTimeLeft(remaining)
    }
    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [session.timer_end])

  // タイムアウト時の自動送信 or スキップ
  useEffect(() => {
    if (timeLeft === 0 && isMyTurn && !skipCalledRef.current && !turnLocked) {
      skipCalledRef.current = true
      const currentContent = contentRef.current.trim().slice(0, effectiveCharLimit)
      startTransition(async () => {
        if (currentContent) {
          const result = await submitSentence(
            session.id, currentContent, session.current_turn,
            effectiveCharLimit, room.timer_seconds,
          )
          if (!result?.error) setContent('')
        } else {
          await skipTurn(session.id, session.current_turn, room.timer_seconds)
        }
      })
    }
  }, [timeLeft, isMyTurn, session.id, session.current_turn, room.timer_seconds, effectiveCharLimit, turnLocked])

  // Realtime 購読
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`writing-${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => setSession(payload.new as Session))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sentences',
        filter: `session_id=eq.${initialSession.id}`,
      }, (payload) => setSentences((prev) => [...prev, payload.new as Sentence]))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'completion_votes',
        filter: `room_id=eq.${room.id}`,
      }, () => setVoteCount((prev) => prev + 1))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'novels',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => router.push(`/novels/${payload.new.id}`))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_themes',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const updated = payload.new as Theme
        setThemes((prev) => {
          const exists = prev.some((t) => t.user_id === updated.user_id)
          return exists
            ? prev.map((t) => t.user_id === updated.user_id ? updated : t)
            : [...prev, updated]
        })
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_theme_scores',
        filter: `session_id=eq.${initialSession.id}`,
      }, (payload) => {
        const row = payload.new as { user_id?: string; score?: number }
        if (row.user_id === currentUserId && typeof row.score === 'number') {
          setMyThemeScore(row.score)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, initialSession.id, router, currentUserId])

  const handleVote = () => {
    setVoteError(null)
    startVoteTransition(async () => {
      const result = await voteToEnd(room.id)
      if (result?.error) {
        setVoteError(result.error)
      } else {
        setMyVoted(true)
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !isMyTurn || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await submitSentence(
        session.id, content.trim(), session.current_turn,
        effectiveCharLimit, room.timer_seconds,
      )
      if (result?.error) setError(result.error)
      else setContent('')
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">カテゴリ</p>
            <h1 className="font-bold text-gray-800">{room.genre}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              ターン {session.current_turn + 1} / 上限 {maxTurnCap}
              {isSecret ? ' · 秘密テーマ対戦' : ''}
              {room.mode === 'novel' ? ' · 小説バトル' : ''}
            </p>
          </div>
          <TimerDisplay timeLeft={timeLeft} total={room.timer_seconds} />
        </div>

        {session.end_proposed && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-3">
            早期終了が提案されています（スコア・完成度またはターン上限）。全員で完結に投票できます。
          </div>
        )}

        {(typeof session.coherence_score === 'number' || myThemeScore !== null) && (
          <div className="bg-white rounded-xl shadow p-3 text-xs text-gray-600 space-y-1">
            {typeof session.coherence_score === 'number' && (
              <p>物語のつながり（参考）: <span className="font-semibold text-gray-800">{session.coherence_score}</span> / 100</p>
            )}
            {myThemeScore !== null && (
              <p>あなたのテーマへの寄与（参考）: <span className="font-semibold text-indigo-700">{myThemeScore}</span> / 100</p>
            )}
          </div>
        )}

        {/* 物語フェーズヒント（E4） */}
        {room.mode === 'novel' && (() => {
          const phase = getStoryPhase(session.current_turn, maxTurnCap)
          return (
            <div className={`border rounded-xl px-3 py-2 flex items-center gap-2 text-xs ${phase.color}`}>
              <span className="font-bold shrink-0">[{phase.label}]</span>
              <span>{phase.hint}</span>
            </div>
          )
        })()}

        {/* ターン表示 + テーマ */}
        <TurnIndicator
          currentMember={currentMember}
          isMyTurn={isMyTurn}
          turnNumber={session.current_turn + 1}
          roundNumber={roundNumber}
          turnInRound={turnInRound}
          memberCount={memberCount}
          currentTheme={themeLineForIndicator}
          isSecret={isSecret}
        />

        {isSecret && myThemeRow && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm">
            <p className="text-xs text-indigo-600 font-semibold mb-1">あなただけの秘密テーマ</p>
            <p className="text-gray-900 font-medium">「{myThemeRow.theme_text}」</p>
          </div>
        )}

        {/* テーマ一覧（オープンで設定済みの場合） */}
        {!isSecret && themes.length > 0 && (
          <ThemePanel themes={themes} members={orderedMembers} currentUserId={currentUserId} />
        )}

        {/* 完結投票 */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">完結投票</p>
              <p className="text-sm text-gray-700">
                <span className="font-bold text-indigo-600">{voteCount}</span>
                <span className="text-gray-400"> / {memberCount}人</span>
                　（{threshold}票で完結）
              </p>
              <div className="mt-2 w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (voteCount / threshold) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleVote}
                disabled={myVoted || isVoting || sentences.length === 0}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  myVoted
                    ? 'bg-indigo-100 text-indigo-400 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {myVoted ? '投票済み ✓' : isVoting ? '投票中...' : '完結に投票'}
              </button>
              {voteError && <p className="text-xs text-red-500">{voteError}</p>}
            </div>
          </div>
        </div>

        {/* 言葉（フレーズ一覧） */}
        <NovelViewer sentences={sentences} members={sortedMembers} mode={room.mode} />

        {/* 入力欄 */}
        {turnLocked ? (
          <div className="bg-gray-100 rounded-xl shadow p-4 text-center text-sm text-gray-600">
            最大ターンに達しました。完結に投票して作品をまとめてください。
          </div>
        ) : isMyTurn ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="text-indigo-600 font-medium">あなたのターンです！</span>
              <span className={content.length > effectiveCharLimit ? 'text-red-500' : ''}>
                {content.length} / {room.char_limit === null ? '∞' : `${effectiveCharLimit}文字`}
              </span>
            </div>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={isListening ? '🎤 聞き取り中...' : '言葉を紡いでください...'}
                rows={3}
                maxLength={effectiveCharLimit}
                disabled={isPending}
                className={`w-full border rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 resize-none pr-10 ${
                  isListening
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:ring-indigo-500'
                }`}
              />
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? '音声入力を停止' : '音声入力を開始'}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                      : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  🎤
                </button>
              )}
            </div>
            {speechError && <p className="text-xs text-red-500">{speechError}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !content.trim() || content.length > effectiveCharLimit}
              className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isPending ? '投稿中...' : '投稿する'}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-xl shadow p-4 text-center text-sm text-gray-500">
            <span
              className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
              style={{ backgroundColor: currentMember?.color ?? '#9ca3af' }}
            />
            {currentMember?.users?.display_name ?? '不明'}さんの入力を待っています...
          </div>
        )}
      </div>
    </main>
  )
}

type PhaseInfo = { label: string; hint: string; color: string }

function getStoryPhase(currentTurn: number, maxTurns: number): PhaseInfo {
  const ratio = maxTurns > 0 ? currentTurn / maxTurns : 0
  if (ratio < 0.25) return { label: '導入', hint: '人物・状況・世界観を丁寧に描きましょう', color: 'text-sky-600 bg-sky-50 border-sky-200' }
  if (ratio < 0.55) return { label: '展開', hint: '出来事を動かし、登場人物の関係を深めましょう', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
  if (ratio < 0.80) return { label: 'クライマックス', hint: '物語の山場へ向けて盛り上げましょう', color: 'text-orange-600 bg-orange-50 border-orange-200' }
  return { label: '解決', hint: '伏線を回収し、結末へ向かいましょう', color: 'text-purple-600 bg-purple-50 border-purple-200' }
}

function TimerDisplay({ timeLeft, total }: { timeLeft: number; total: number }) {
  const isWarning = timeLeft <= Math.min(10, total * 0.2)
  const pct = Math.max(0, timeLeft / total)

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`text-2xl font-mono font-bold tabular-nums ${isWarning ? 'text-red-500' : 'text-gray-700'}`}>
        {timeLeft}秒
      </div>
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWarning ? 'bg-red-400' : 'bg-indigo-400'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

function TurnIndicator({
  currentMember,
  isMyTurn,
  turnNumber,
  roundNumber,
  turnInRound,
  memberCount,
  currentTheme,
  isSecret,
}: {
  currentMember: Member | undefined
  isMyTurn: boolean
  turnNumber: number
  roundNumber: number
  turnInRound: number
  memberCount: number
  currentTheme: string | undefined
  isSecret: boolean
}) {
  return (
    <div className={`rounded-xl shadow p-3 space-y-1 ${isMyTurn ? 'bg-indigo-50 border border-indigo-200' : 'bg-white'}`}>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: currentMember?.color ?? '#9ca3af' }} />
        <span className="text-sm font-medium text-gray-700">
          第{roundNumber}周 {turnInRound}/{memberCount}　ターン{turnNumber}：
          {isMyTurn
            ? <span className="text-indigo-600 font-bold"> あなたのターン！</span>
            : <span> {currentMember?.users?.display_name ?? '不明'}さん</span>}
        </span>
      </div>
      {currentTheme && (
        <p className="text-xs text-gray-500 pl-7">
          テーマ：<span className="font-medium text-gray-700">「{currentTheme}」</span>
        </p>
      )}
      {isSecret && !isMyTurn && (
        <p className="text-xs text-gray-400 pl-7">相手のテーマは非公開です。</p>
      )}
    </div>
  )
}

function ThemePanel({ themes, members, currentUserId }: {
  themes: Theme[]
  members: Member[]
  currentUserId: string
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">各自のテーマ</h2>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const theme = themes.find((t) => t.user_id === m.user_id)
          if (!theme) return null
          const isMe = m.user_id === currentUserId
          return (
            <div
              key={m.user_id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isMe ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-200'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-gray-500">{m.users?.display_name ?? '不明'}：</span>
              <span className="font-medium text-gray-800">「{theme.theme_text}」</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NovelViewer({ sentences, members, mode }: { sentences: Sentence[]; members: Member[]; mode: string }) {
  const memberMap = new Map(members.map((m) => [m.user_id, m]))
  const sorted = [...sentences].sort((a, b) => a.seq - b.seq)
  const isNovel = mode === 'novel'

  return (
    <div className={`bg-white rounded-xl shadow p-4 overflow-y-auto ${isNovel ? 'min-h-48 max-h-[32rem]' : 'min-h-32 max-h-96'}`}>
      <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        {isNovel ? '小説' : '言葉'}
      </h2>
      {sorted.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          {isNovel ? 'まだ投稿がありません。最初の段落を書きましょう！' : 'まだフレーズがありません。最初の言葉を紡ぎましょう！'}
        </p>
      ) : isNovel ? (
        <div className="space-y-4 font-serif">
          {sorted.map((sentence) => {
            const member = memberMap.get(sentence.user_id)
            return (
              <div key={sentence.id} className="relative pl-3 border-l-2" style={{ borderColor: member?.color ?? '#9ca3af' }}>
                <p className="text-gray-900 text-base leading-8 whitespace-pre-wrap">{sentence.content}</p>
                <p className="text-xs text-gray-400 mt-1">{member?.users?.display_name ?? '不明'}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map((sentence) => {
            const member = memberMap.get(sentence.user_id)
            return (
              <span key={sentence.id} className="inline">
                <span
                  className="inline-block w-2 h-2 rounded-full mx-0.5 align-middle flex-shrink-0"
                  style={{ backgroundColor: member?.color ?? '#9ca3af' }}
                  title={member?.users?.display_name ?? '不明'}
                />
                <span className="text-gray-900 text-sm leading-relaxed">{sentence.content}</span>
                {' '}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
