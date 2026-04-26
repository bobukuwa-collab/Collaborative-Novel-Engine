'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { startSession } from '@/lib/sessions/actions'
import { setTheme } from '@/lib/rooms/actions'

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

type Room = {
  id: string
  genre: string
  max_players: number
  char_limit: number
  timer_seconds: number
  turn_order_mode: string
  game_mode: string
  status: string
  join_code: string
  room_members: Member[]
}

type Props = {
  room: Room
  currentUserId: string
  inviteUrl: string
  initialThemes: Theme[]
  startError?: string
}

function ThemeSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {pending ? '設定中...' : '設定'}
    </button>
  )
}

export function WaitingRoom({ room, currentUserId, inviteUrl, initialThemes, startError }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [themes, setThemes] = useState<Theme[]>(initialThemes)
  const [, startTransition] = useTransition()

  const [themeState, themeAction] = useFormState(setTheme, null)
  const memberCountRef = useRef(room.room_members.length)
  useEffect(() => { memberCountRef.current = room.room_members.length }, [room.room_members.length])

  const isHost = room.room_members.some(
    (m) => m.user_id === currentUserId && m.join_order === 0,
  )
  const sortedMembers = [...room.room_members].sort((a, b) => a.join_order - b.join_order)
  const canStart = isHost && room.room_members.length >= 2
  const myTheme = themes.find((t) => t.user_id === currentUserId)
  const isSecret = room.game_mode === 'secret_battle'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Realtime: メンバー参加・セッション開始・テーマ設定を検知
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`waiting-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${room.id}`,
        },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `room_id=eq.${room.id}`,
        },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_themes',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as Theme
          startTransition(() => {
            setThemes((prev) => {
              const exists = prev.some((t) => t.user_id === updated.user_id)
              return exists
                ? prev.map((t) => t.user_id === updated.user_id ? updated : t)
                : [...prev, updated]
            })
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, router])

  // ポーリングフォールバック（Realtime 取りこぼし対策、3秒ごと）
  useEffect(() => {
    const supabase = createClient()
    const poll = setInterval(async () => {
      const { count } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
      if (count !== null && count !== memberCountRef.current) {
        router.refresh()
        return
      }
      // セッション開始を検知
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('room_id', room.id)
        .maybeSingle()
      if (data) router.refresh()
    }, 3000)
    return () => clearInterval(poll)
  }, [room.id, router])

  const startSessionForRoom = startSession.bind(null, room.id)

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">

        {/* ルーム情報 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">待機室</h1>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
              参加待ち
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500">カテゴリ</p>
              <p className="font-semibold text-gray-800 text-sm">{room.genre}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">人数</p>
              <p className="font-semibold text-gray-800 text-sm">
                {room.room_members.length} / {room.max_players}人
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">タイマー</p>
              <p className="font-semibold text-gray-800 text-sm">{room.timer_seconds}秒</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ターン順</p>
              <p className="font-semibold text-gray-800 text-sm">
                {room.turn_order_mode === 'random' ? 'ランダム' : '固定'}
              </p>
            </div>
          </div>
          {isSecret && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mt-3">
              秘密テーマ対戦：執筆開始時にAIが参加者それぞれに異なるテーマを配ります（他者のテーマは見えません）。
            </p>
          )}
          <p className="text-xs text-indigo-700 bg-indigo-50 rounded-md px-2 py-1.5 mt-2">
            小説バトル：段落単位の長文で執筆します。AIスコアリングあり。
          </p>
        </div>

        {startError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">
            {startError}
          </div>
        )}

        {/* テーマ設定（オープンのみ） */}
        {!isSecret && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">あなたのテーマを設定</h2>
              <p className="text-xs text-gray-400">自分のテーマへ文章を引き込むのが勝負の軸です。任意ですが設定することを推奨します。</p>
            </div>
            <form action={themeAction} className="flex gap-2">
              <input type="hidden" name="room_id" value={room.id} />
              <input
                type="text"
                name="theme_text"
                defaultValue={myTheme?.theme_text ?? ''}
                placeholder="例：孤独な旅人が故郷を思う"
                maxLength={50}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <ThemeSubmitButton />
            </form>
            {themeState?.error && (
              <p className="text-xs text-red-500">{themeState.error}</p>
            )}

            {themes.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium">設定済みテーマ</p>
                {sortedMembers.map((member) => {
                  const theme = themes.find((t) => t.user_id === member.user_id)
                  return (
                    <div key={member.user_id} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="text-xs text-gray-500 w-20 truncate">
                        {member.users?.display_name ?? '不明'}
                      </span>
                      {theme ? (
                        <span className="text-sm text-gray-800 font-medium">「{theme.theme_text}」</span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">未設定</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 招待 */}
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">友達を招待する</h2>

          {/* ルームコード（メイン） */}
          <div className="text-center bg-indigo-50 rounded-lg py-4">
            <p className="text-xs text-indigo-500 mb-1">ルームコード</p>
            <p className="text-4xl font-mono font-bold tracking-widest text-indigo-700">
              {room.join_code}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              参加者は「コードで参加」からこのコードを入力
            </p>
          </div>

          {/* URLコピー（サブ） */}
          <div>
            <p className="text-xs text-gray-500 mb-2">または招待リンクをコピー</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-900 truncate"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                {copied ? 'コピー済み ✓' : 'コピー'}
              </button>
            </div>
          </div>
        </div>

        {/* 参加者一覧 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            参加者 ({room.room_members.length}/{room.max_players})
          </h2>
          <ul className="space-y-2">
            {sortedMembers.map((member) => (
              <li key={member.user_id} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <span className="text-sm text-gray-700">
                  {member.users?.display_name ?? '不明なユーザー'}
                </span>
                {member.user_id === currentUserId && (
                  <span className="text-xs text-gray-400">（あなた）</span>
                )}
                {member.join_order === 0 && (
                  <span className="text-xs text-indigo-500 ml-auto">ホスト</span>
                )}
                {!isSecret && themes.some((t) => t.user_id === member.user_id) && (
                  <span className="text-xs text-green-500 ml-auto">テーマ設定済み ✓</span>
                )}
              </li>
            ))}
          </ul>

          <form action={startSessionForRoom} className="mt-4">
            <button
              type="submit"
              disabled={!canStart}
              className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {!isHost
                ? 'ホストが開始するまでお待ちください'
                : room.room_members.length < 2
                  ? 'あと1人以上参加が必要です'
                  : '執筆を開始'}
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
