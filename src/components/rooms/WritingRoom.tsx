'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitSentence, skipTurn, voteToEnd } from '@/lib/sessions/actions'

type Session = {
  id: string
  room_id: string
  current_turn: number
  timer_end: string
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

type Room = {
  id: string
  genre: string
  char_limit: number
  timer_seconds: number
}

type Props = {
  room: Room
  session: Session
  members: Member[]
  initialSentences: Sentence[]
  currentUserId: string
  initialVoteCount: number
  myVoted: boolean
}

export function WritingRoom({
  room,
  session: initialSession,
  members,
  initialSentences,
  currentUserId,
  initialVoteCount,
  myVoted: initialMyVoted,
}: Props) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [sentences, setSentences] = useState(initialSentences)
  const [content, setContent] = useState('')
  const [timeLeft, setTimeLeft] = useState(room.timer_seconds)
  const [error, setError] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(initialVoteCount)
  const [myVoted, setMyVoted] = useState(initialMyVoted)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isVoting, startVoteTransition] = useTransition()
  const skipCalledRef = useRef(false)

  const sortedMembers = [...members].sort((a, b) => a.join_order - b.join_order)
  const memberCount = sortedMembers.length
  const threshold = memberCount === 2 ? 2 : Math.floor(memberCount / 2) + 1
  const currentMemberIndex = session.current_turn % sortedMembers.length
  const currentMember = sortedMembers[currentMemberIndex]
  const isMyTurn = currentMember?.user_id === currentUserId

  useEffect(() => {
    skipCalledRef.current = false
    setError(null)
  }, [session.current_turn])

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

  useEffect(() => {
    if (timeLeft === 0 && isMyTurn && !skipCalledRef.current) {
      skipCalledRef.current = true
      startTransition(async () => {
        await skipTurn(session.id, session.current_turn, room.timer_seconds)
      })
    }
  }, [timeLeft, isMyTurn, session.id, session.current_turn, room.timer_seconds])

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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, initialSession.id, router])

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
        room.char_limit, room.timer_seconds,
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
            <p className="text-xs text-gray-500">ジャンル</p>
            <h1 className="font-bold text-gray-800">{room.genre}</h1>
          </div>
          <TimerDisplay timeLeft={timeLeft} total={room.timer_seconds} />
        </div>

        {/* ターン表示 */}
        <TurnIndicator
          currentMember={currentMember}
          isMyTurn={isMyTurn}
          turnNumber={session.current_turn + 1}
        />

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
              {/* 投票バー */}
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

        {/* 小説本文 */}
        <NovelViewer sentences={sentences} members={sortedMembers} />

        {/* 入力欄 */}
        {isMyTurn ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="text-indigo-600 font-medium">あなたのターンです！</span>
              <span className={content.length > room.char_limit ? 'text-red-500' : ''}>
                {content.length} / {room.char_limit}文字
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="続きを書いてください..."
              rows={3}
              maxLength={room.char_limit}
              disabled={isPending}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !content.trim() || content.length > room.char_limit}
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

function TimerDisplay({ timeLeft, total }: { timeLeft: number; total: number }) {
  const isWarning = timeLeft <= 10
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

function TurnIndicator({ currentMember, isMyTurn, turnNumber }: {
  currentMember: Member | undefined; isMyTurn: boolean; turnNumber: number
}) {
  return (
    <div className={`rounded-xl shadow p-3 flex items-center gap-3 ${isMyTurn ? 'bg-indigo-50 border border-indigo-200' : 'bg-white'}`}>
      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: currentMember?.color ?? '#9ca3af' }} />
      <span className="text-sm font-medium text-gray-700">
        第{turnNumber}ターン：
        {isMyTurn
          ? <span className="text-indigo-600 font-bold"> あなたのターン！</span>
          : <span> {currentMember?.users?.display_name ?? '不明'}さん</span>}
      </span>
    </div>
  )
}

function NovelViewer({ sentences, members }: { sentences: Sentence[]; members: Member[] }) {
  const memberMap = new Map(members.map((m) => [m.user_id, m]))
  return (
    <div className="bg-white rounded-xl shadow p-4 min-h-32 max-h-96 overflow-y-auto">
      <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">物語</h2>
      {sentences.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">まだ文章がありません。最初の1文を書きましょう！</p>
      ) : (
        <div className="space-y-1">
          {[...sentences].sort((a, b) => a.seq - b.seq).map((sentence) => {
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
