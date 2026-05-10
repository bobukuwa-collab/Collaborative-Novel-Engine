import { Header } from '@/components/layout/Header'
import { CreateRoomForm } from '@/components/rooms/CreateRoomForm'

export default function NewRoomPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-stone-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900">新しいセッションを開始</h1>
            <p className="text-sm text-gray-500 mt-1">ジャンルと長さを選んで、AIとの共著を始めましょう</p>
          </div>
          <CreateRoomForm />
        </div>
      </main>
    </>
  )
}
