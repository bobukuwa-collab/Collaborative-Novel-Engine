'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Novel = {
  id: string
  title: string
  published_at: string | null
  room_id: string
  genre: string
  likeCount: number
  sentenceCount: number
}

type Props = {
  novels: Novel[]
}

export function LibraryList({ novels }: Props) {
  const router = useRouter()

  // 新しい作品が完結した時にリスト更新
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('library-novels')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'novels' },
        () => router.refresh(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  if (novels.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
        まだ完成作品がありません。最初の言葉のバトンを始めましょう！
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {novels.map((novel) => {
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
                    {novel.genre} · {novel.sentenceCount}フレーズ · {publishedAt}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-pink-400 text-sm flex-shrink-0">
                  <span>♥</span>
                  <span>{novel.likeCount}</span>
                </div>
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
