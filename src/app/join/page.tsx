import { Header } from '@/components/layout/Header'
import { JoinForm } from './JoinForm'

export default function JoinPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <JoinForm />
      </main>
    </>
  )
}
