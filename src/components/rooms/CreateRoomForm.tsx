'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createRoom } from '@/lib/rooms/actions'

const GENRES = ['ファンタジー', 'SF', 'ミステリー', '恋愛', 'ホラー', '日常', 'その他']

const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
    >
      {pending ? '作成中...' : 'ルームを作成して招待リンクを取得'}
    </button>
  )
}

export function CreateRoomForm() {
  const [state, formAction] = useFormState(createRoom, null)

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル</label>
        <select name="genre" required className={SELECT_CLASS}>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">最大人数</label>
        <select name="max_players" defaultValue="3" className={SELECT_CLASS}>
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n}人</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          1ターンのタイマー
        </label>
        <select name="timer_seconds" defaultValue="60" className={SELECT_CLASS}>
          <option value="30">30秒（スピード重視）</option>
          <option value="60">60秒（標準）</option>
          <option value="90">90秒（じっくり）</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          1文あたりの文字数上限
        </label>
        <select name="char_limit" defaultValue="100" className={SELECT_CLASS}>
          <option value="20">20文字</option>
          <option value="50">50文字</option>
          <option value="100">100文字</option>
          <option value="150">150文字</option>
          <option value="200">200文字</option>
        </select>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  )
}
