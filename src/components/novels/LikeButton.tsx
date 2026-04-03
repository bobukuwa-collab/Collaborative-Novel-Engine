'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/lib/novels/actions'

type Props = {
  novelId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ novelId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleLike(novelId)
      if (!result.error) {
        setLiked(result.liked ?? !liked)
        setCount((prev) => (result.liked ? prev + 1 : prev - 1))
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
        liked
          ? 'bg-pink-50 border-pink-300 text-pink-600 hover:bg-pink-100'
          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
      } disabled:opacity-50`}
    >
      <span>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  )
}
