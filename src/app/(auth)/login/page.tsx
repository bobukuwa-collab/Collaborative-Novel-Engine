import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          協調小説エンジン
        </h1>
        <p className="text-sm text-center text-gray-500 mb-6">
          見知らぬ誰かと、小説を完成させよう
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
