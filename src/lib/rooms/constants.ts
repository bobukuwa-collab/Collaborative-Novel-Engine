export const ALLOWED_GENRES = [
  '愛と恋',
  '孤独と静寂',
  '哲学と人生',
  'ダークファンタジー',
  'ホラー',
  'SF・宇宙',
  '日常と記憶',
  '友情と裏切り',
  'ユーモア',
  'ランダム',
] as const

export type Genre = typeof ALLOWED_GENRES[number]
