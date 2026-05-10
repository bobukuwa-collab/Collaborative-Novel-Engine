'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createRoom } from '@/lib/rooms/actions'
import { ALLOWED_GENRES } from '@/lib/rooms/constants'

const MAX_TURNS_PRESETS = [
  { label: '短編 (20ターン)', value: 20 },
  { label: '中編 (30ターン)', value: 30 },
  { label: '長編 (50ターン)', value: 50 },
]

const PRESET_BASE = 'px-4 py-2 text-sm rounded-lg border transition-colors'
const PRESET_ACTIVE = 'bg-indigo-600 text-white border-indigo-600'
const PRESET_IDLE = 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-base"
    >
      {pending ? 'セッションを準備中...' : '執筆を始める'}
    </button>
  )
}

export function CreateRoomForm() {
  const [state, formAction] = useFormState(createRoom, null)
  const [maxTurns, setMaxTurns] = useState(30)

  return (
    <form action={formAction} className="space-y-6">
      {/* ジャンル */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">物語のジャンル</label>
        <select
          name="genre"
          required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {ALLOWED_GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">AIがこのジャンルに合わせて応答します</p>
      </div>

      {/* ターン数 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">物語の長さ</label>
        <input type="hidden" name="max_turns" value={maxTurns} />
        <div className="flex flex-wrap gap-2">
          {MAX_TURNS_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setMaxTurns(p.value)}
              className={`${PRESET_BASE} ${maxTurns === p.value ? PRESET_ACTIVE : PRESET_IDLE}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          あなたが書く回数：{maxTurns / 2}回 / AIが書く回数：{maxTurns / 2}回
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  )
}
