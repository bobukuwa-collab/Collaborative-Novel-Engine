import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'

export default async function LibraryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, published_at, room_id, rooms(genre)')
    .eq('status', 'completed')
    .order('published_at', { ascending: false })

  // 各小説のいいね数・文章数を取得
  const novelIds = (novels ?? []).map((n) => n.id)

  const likeCounts: Record<string, number> = {}
  const sentenceCounts: Record<string, number> = {}

  if (novelIds.length > 0) {
    const { data: likes } = await supabase
      .from('likes')
      .select('novel_id')
      .in('novel_id', novelIds)

    for (const like of likes ?? []) {
      likeCounts[like.novel_id] = (likeCounts[like.novel_id] ?? 0) + 1
    }

    // 各ルームの最新セッションのみ取得して文章数を集計
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, room_id, created_at')
      .in('room_id', (novels ?? []).map((n) => n.room_id))
      .order('created_at', { ascending: false })

    // ルームごとに最新セッションIDのみ保持
    const latestSessionMap = new Map<string, string>()
    for (const s of sessions ?? []) {
      if (!latestSessionMap.has(s.room_id)) {
        latestSessionMap.set(s.room_id, s.id)
      }
    }
    const latestSessionIds = Array.from(latestSessionMap.values())

    if (latestSessionIds.length > 0) {
      const { data: counts } = await supabase
        .from('sentences')
        .select('session_id')
        .in('session_id', latestSessionIds)

      // sessionId → roomId の逆引きマップ
      const sessionToRoom = new Map<string, string>()
      latestSessionMap.forEach((sessionId, roomId) => sessionToRoom.set(sessionId, roomId))
      const roomToNovel = new Map((novels ?? []).map((n) => [n.room_id, n.id]))

      for (const row of counts ?? []) {
        const roomId = sessionToRoom.get(row.session_id)
        if (!roomId) continue
        const novelId = roomToNovel.get(roomId)
        if (!novelId) continue
        sentenceCounts[novelId] = (sentenceCounts[novelId] ?? 0) + 1
      }
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-800">公開ライブラリ</h1>
            <a
              href="/rooms/new"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              新しいルームを作る
            </a>
          </div>

          {(!novels || novels.length === 0) ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
              まだ完結作品がありません。最初の共著小説を書きましょう！
            </div>
          ) : (
            <ul className="space-y-3">
              {novels.map((novel) => {
                const genre = (novel.rooms as unknown as { genre: string } | null)?.genre ?? ''
                const publishedAt = novel.published_at
                  ? new Date(novel.published_at).toLocaleDateString('ja-JP')
                  : ''
                return (
                  <li key={novel.id}>
                    <a
                      href={`/novels/${novel.id}`}
                      className="block bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-semibold text-gray-800 mb-1">{novel.title}</h2>
                          <p className="text-xs text-gray-500">
                            {genre} · {sentenceCounts[novel.id] ?? 0}文 · {publishedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-pink-400 text-sm flex-shrink-0">
                          <span>♥</span>
                          <span>{likeCounts[novel.id] ?? 0}</span>
                        </div>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  )
}
