'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { joinRoomByCode } from '@/lib/rooms/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
    >
      {pending ? '検索中...' : '参加する'}
    </button>
  )
}

export function JoinForm() {
  const [state, formAction] = useFormState(joinRoomByCode, null)

  return (
    <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-1">ルームに参加</h1>
        <p className="text-sm text-gray-500">ホストから受け取ったコードを入力してください</p>
      </div>

      <form action={formAction} className="space-y-4">
        <input
          type="text"
          name="code"
          placeholder="例：ABC123"
          maxLength={10}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full text-center text-2xl font-mono tracking-widest uppercase border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
        />
        {state?.error && (
          <p className="text-sm text-red-500 text-center">{state.error}</p>
        )}
        <SubmitButton />
      </form>

      <p className="text-center text-sm">
        <a href="/" className="text-indigo-600 hover:underline">← トップに戻る</a>
      </p>
    </div>
  )
}
