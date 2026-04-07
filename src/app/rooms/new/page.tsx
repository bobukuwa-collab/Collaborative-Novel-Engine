import { Header } from '@/components/layout/Header'
import { CreateRoomForm } from '@/components/rooms/CreateRoomForm'

export default function NewRoomPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">新しいルームを作成</h1>
          <CreateRoomForm />
        </div>
      </main>
    </>
  )
}
