'use client'

export default function RoomsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center">
        <h1 className="text-red-600 font-bold mb-2">エラーが発生しました</h1>
        <p className="text-sm text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
        >
          再試行
        </button>
      </div>
    </main>
  )
}
