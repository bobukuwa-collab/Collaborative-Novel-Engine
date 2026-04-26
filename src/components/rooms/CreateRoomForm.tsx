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

const CHAR_LIMIT_PRESETS = [
  { label: '100文字', value: 100 },
  { label: '200文字', value: 200 },
  { label: '300文字（推奨）', value: 300 },
  { label: '500文字', value: 500 },
  { label: '∞', value: null },
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
  const [charLimit, setCharLimit] = useState<number | null>(300)
  const [turnOrderMode, setTurnOrderMode] = useState<'fixed' | 'random'>('fixed')
  const [gameMode, setGameMode] = useState<'open' | 'secret_battle'>('secret_battle')
  const [maxTurns, setMaxTurns] = useState(48)
  const [roomMode, setRoomMode] = useState<'relay' | 'novel'>('relay')

  const handleRoomModeChange = (next: 'relay' | 'novel') => {
    setRoomMode(next)
    if (next === 'novel') {
      setCharLimit(null)
      if (timerSeconds < 120) setTimerSeconds(120)
    } else {
      setCharLimit(300)
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="mode" value={roomMode} />

      {/* ルームモード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ルームモード</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleRoomModeChange('relay')}
            className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
              roomMode === 'relay'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <span className="text-sm font-semibold text-gray-800">言葉のバトン</span>
            <span className="text-xs text-gray-500 mt-1">短いフレーズをリレーする従来モード</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoomModeChange('novel')}
            className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
              roomMode === 'novel'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <span className="text-sm font-semibold text-gray-800">小説バトル</span>
            <span className="text-xs text-gray-500 mt-1">段落単位の長文。文字数∞・長タイマーに自動設定</span>
          </button>
        </div>
      </div>

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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1ターンあたりの文字数上限
        </label>
        <input type="hidden" name="char_limit" value={charLimit === null ? 'null' : charLimit} />
        <div className="flex flex-wrap gap-2">
          {CHAR_LIMIT_PRESETS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              onClick={() => setCharLimit(p.value)}
              className={`${PRESET_BASE} ${charLimit === p.value ? PRESET_ACTIVE : PRESET_IDLE}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {charLimit === null && (
          <p className="mt-1 text-xs text-gray-500">∞ を選択中：最大1000文字まで入力できます</p>
        )}
      </div>

      {/* ゲームモード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ゲームモード</label>
        <input type="hidden" name="game_mode" value={gameMode} />
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="_game_mode_ui"
              checked={gameMode === 'open'}
              onChange={() => setGameMode('open')}
              className="accent-indigo-600 mt-1"
            />
            <span>
              <span className="text-sm font-medium text-gray-800">オープン</span>
              <span className="block text-xs text-gray-500">全員のテーマが見える。開始前に各自がテーマを入力。</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="_game_mode_ui"
              checked={gameMode === 'secret_battle'}
              onChange={() => setGameMode('secret_battle')}
              className="accent-indigo-600 mt-1"
            />
            <span>
              <span className="text-sm font-medium text-gray-800">秘密テーマ対戦</span>
              <span className="block text-xs text-gray-500">
                開始時にAIが参加者ごとに異なるテーマを配布（自分のテーマのみ表示）。サーバに SUPABASE_SERVICE_ROLE_KEY が必要です。
              </span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">最大ターン数（強制終了の目安）</label>
        <input
          type="number"
          name="max_turns"
          value={maxTurns}
          min={5}
          max={200}
          onChange={(e) => setMaxTurns(Number(e.target.value))}
          className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
        />
        <span className="text-sm text-gray-600 ml-2">（5〜200・この回数でターンが止まります）</span>
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
