import { anthropicMessages } from '@/lib/ai/anthropic'

const FALLBACK_THEMES = [
  '失われた手紙の謎',
  '雨に濡れた約束',
  '終着駅の別れ',
  '古い時計の音',
  '冬の窓辺の灯',
  '海へ続く坂道',
  '誰もいない教室',
  '星を数える屋上',
  '消えた猫の足跡',
  '朝霧の橋',
  '図書館の最後の一冊',
  '夏祭りのあと',
  '鏡に映らない人',
  '砂時計の底',
  '遠い雷鳴',
  '白いマフラーの少女',
  '錆びた鍵と扉',
  '終わらない歌',
  '水底の街',
  '風の向くまま',
]

export type AssignedTheme = { user_id: string; theme_text: string }

/**
 * 参加者ごとに異なる短いテーマ（最大50文字）を生成する。
 * ANTHROPIC_API_KEY が無い場合はローカル候補から決定的に割り当てる。
 */
export async function assignThemesForMembers(
  genre: string,
  memberUserIds: string[],
): Promise<AssignedTheme[]> {
  if (memberUserIds.length === 0) return []

  if (!process.env.ANTHROPIC_API_KEY) {
    return deterministicFallback(memberUserIds)
  }

  const system = [
    'あなたは短い創作テーマを出題するアシスタントです。',
    '出力は厳密にJSONオブジェクトのみ。説明文は禁止。',
    `キー "themes" に { "user_id": "<uuid>", "theme_text": "<1〜50文字の日本語>" } の配列。要素数は正確に ${memberUserIds.length}。`,
    '各 theme_text は重複禁止。カテゴリの雰囲気に合わせるが、固有名詞は避ける。',
    `カテゴリ: ${genre}`,
    'user_id は次のUUIDのみを使うこと:',
    memberUserIds.join(', '),
  ].join('\n')

  const raw = await anthropicMessages({
    system,
    messages: [
      {
        role: 'user',
        content: 'JSONのみで返答してください。',
      },
    ],
    maxTokens: 800,
  })

  const json = extractJsonObject(raw)
  const arr = json?.themes as unknown
  if (!Array.isArray(arr) || arr.length !== memberUserIds.length) {
    return deterministicFallback(memberUserIds)
  }

  const out: AssignedTheme[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const uid = (row as { user_id?: string }).user_id
    let text = String((row as { theme_text?: string }).theme_text ?? '').trim()
    if (!uid || !memberUserIds.includes(uid)) continue
    if (text.length > 50) text = text.slice(0, 50)
    if (text.length < 1) continue
    out.push({ user_id: uid, theme_text: text })
  }

  if (out.length !== memberUserIds.length) {
    return deterministicFallback(memberUserIds)
  }
  return out
}

function deterministicFallback(memberUserIds: string[]): AssignedTheme[] {
  const shuffled = shuffleWithSeed([...FALLBACK_THEMES], memberUserIds.join(','))
  return memberUserIds.map((user_id, i) => ({
    user_id,
    theme_text: shuffled[i % shuffled.length]!,
  }))
}

function shuffleWithSeed<T>(arr: T[], seed: string): T[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 2654435761) | 0
  }
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822519) | 0
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917) | 0
    hash = (hash ^ (hash >>> 16)) >>> 0
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}
