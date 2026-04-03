import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ContributionChart } from '@/components/novels/ContributionChart'
import { LikeButton } from '@/components/novels/LikeButton'
import { redirect } from 'next/navigation'

export default async function NovelPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: novel, error } = await supabase
    .from('novels')
    .select('*, rooms(genre, max_players)')
    .eq('id', params.id)
    .single()

  if (error || !novel) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">小説が見つかりません。</p>
        </main>
      </>
    )
  }

  // セッション経由で文章を取得
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', novel.room_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const sentences = session
    ? (
        await supabase
          .from('sentences')
          .select('id, user_id, content, seq')
          .eq('session_id', session.id)
          .order('seq', { ascending: true })
      ).data ?? []
    : []

  // メンバー情報取得
  const { data: members } = await supabase
    .from('room_members')
    .select('user_id, color, join_order, users(display_name)')
    .eq('room_id', novel.room_id)

  const memberMap = new Map(
    (members ?? []).map((m) => [
      m.user_id,
      {
        color: m.color,
        name:
          (Array.isArray(m.users)
            ? m.users[0]?.display_name
            : (m.users as { display_name: string } | null)?.display_name) ?? '不明',
      },
    ]),
  )

  // 貢献率計算
  const contributionMap = new Map<
    string,
    { name: string; color: string; sentences: number; characters: number }
  >()
  for (const s of sentences) {
    const member = memberMap.get(s.user_id)
    if (!member) continue
    const existing = contributionMap.get(s.user_id)
    if (existing) {
      existing.sentences += 1
      existing.characters += s.content.length
    } else {
      contributionMap.set(s.user_id, {
        name: member.name,
        color: member.color,
        sentences: 1,
        characters: s.content.length,
      })
    }
  }
  const contributionData = Array.from(contributionMap.values())

  // いいね情報
  const { count: likeCount } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('novel_id', params.id)

  const { data: myLike } = await supabase
    .from('likes')
    .select('novel_id')
    .eq('novel_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const genre = (novel.rooms as { genre: string } | null)?.genre ?? ''
  const publishedAt = novel.published_at
    ? new Date(novel.published_at).toLocaleDateString('ja-JP')
    : ''

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* タイトル・メタ */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800 mb-1">{novel.title}</h1>
                <p className="text-xs text-gray-500">
                  {genre} · {sentences.length}文 · {publishedAt} 完結
                </p>
              </div>
              <LikeButton
                novelId={params.id}
                initialLiked={!!myLike}
                initialCount={likeCount ?? 0}
              />
            </div>
          </div>

          {/* 小説本文 */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">物語</h2>
            {sentences.length === 0 ? (
              <p className="text-gray-400 text-sm">文章がありません。</p>
            ) : (
              <div className="leading-8 text-gray-800 text-sm">
                {sentences.map((s) => {
                  const member = memberMap.get(s.user_id)
                  return (
                    <span key={s.id} className="inline">
                      <span
                        className="inline-block w-2 h-2 rounded-full mx-0.5 align-middle"
                        style={{ backgroundColor: member?.color ?? '#9ca3af' }}
                        title={member?.name ?? '不明'}
                      />
                      {s.content}{' '}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* 貢献率グラフ */}
          {contributionData.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                貢献率
              </h2>
              <ContributionChart data={contributionData} />
              <div className="mt-4 space-y-1">
                {contributionData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-gray-400">
                      {d.sentences}文 · {d.characters}字
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <a href="/library" className="text-sm text-indigo-600 hover:underline">
              ← ライブラリに戻る
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
