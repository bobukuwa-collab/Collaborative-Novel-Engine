'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createRoom } from '@/lib/rooms/actions'

const CATEGORIES = [
  '愛と恋',
  '自然と季節',
  '哲学と人生',
  '夢と希望',
  'ユーモア',
  '孤独と静寂',
  '友情と仲間',
  '宇宙と神秘',
  '食と日常',
  'ランダム',
]

const TIMER_PRESETS = [
  { label: '15秒', value: 15 },
  { label: '30秒', value: 30 },
  { label: '60秒', value: 60 },
  { label: '90秒', value: 90 },
  { label: '2分', value: 120 },
  { label: '3分', value: 180 },
]

const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const PRESET_BASE = 'px-3 py-1.5 text-sm rounded-md border transition-colors'
const PRESET_ACTIVE = 'bg-indigo-600 text-white border-indigo-600'
const PRESET_IDLE = 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'

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
  const [timerSeconds, setTimerSeconds] = useState(60)
  const [turnOrderMode, setTurnOrderMode] = useState<'fixed' | 'random'>('fixed')

  return (
    <form action={formAction} className="space-y-5">
      {/* カテゴリ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
        <select name="genre" required className={SELECT_CLASS}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 参加人数 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">参加人数</label>
        <select name="max_players" defaultValue="3" className={SELECT_CLASS}>
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n}人</option>
          ))}
        </select>
      </div>

      {/* タイマー設定（自由入力 + プリセット） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1ターンのタイマー
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {TIMER_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setTimerSeconds(p.value)}
              className={`${PRESET_BASE} ${timerSeconds === p.value ? PRESET_ACTIVE : PRESET_IDLE}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="timer_seconds"
            value={timerSeconds}
            min={10}
            max={600}
            onChange={(e) => setTimerSeconds(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
          />
          <span className="text-sm text-gray-600">秒　（10〜600秒）</span>
        </div>
      </div>

      {/* 文字数上限 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          1フレーズあたりの文字数上限
        </label>
        <select name="char_limit" defaultValue="40" className={SELECT_CLASS}>
          <option value="20">20文字（一言）</option>
          <option value="30">30文字（短句）</option>
          <option value="40">40文字（フレーズ）</option>
          <option value="60">60文字（詩的な一節）</option>
          <option value="80">80文字（格言）</option>
          <option value="150">150文字（段落）</option>
          <option value="200">200文字（長文）</option>
        </select>
      </div>

      {/* ターン順モード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ターン順</label>
        <input type="hidden" name="turn_order_mode" value={turnOrderMode} />
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="_turn_order_mode_ui"
              checked={turnOrderMode === 'fixed'}
              onChange={() => setTurnOrderMode('fixed')}
              className="accent-indigo-600"
            />
            <span className="text-sm text-gray-700">固定順（参加順）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="_turn_order_mode_ui"
              checked={turnOrderMode === 'random'}
              onChange={() => setTurnOrderMode('random')}
              className="accent-indigo-600"
            />
            <span className="text-sm text-gray-700">ランダム順</span>
          </label>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  )
}
