import { anthropicMessages } from '@/lib/ai/anthropic'

// ジャンル別のフォールバックテーマ（具体的・イメージしやすいもの）
const FALLBACK_THEMES_BY_GENRE: Record<string, string[]> = {
  SF: [
    '人間に恋した人工知能の孤独',
    '記憶を売って生きる移民',
    '最後の宇宙飛行士が地球を見る',
    '老いることを禁じられた人間の後悔',
    '故郷の星を失った子どもの夢',
    '人間と機械の境界で迷う医者',
  ],
  ファンタジー: [
    '魔法を失った魔女の新しい生き方',
    '英雄の息子が父の影から逃げる旅',
    '呪われた森を守る最後の精霊',
    '竜と友になった少女の別れ',
    '魔法使いと剣士の静かな友情',
    '禁断の魔法書を燃やす決断',
  ],
  ミステリー: [
    '嘘をつき続けた探偵の懺悔',
    '犯人を知りながら黙った証人',
    '消えた親友を20年後に探す旅',
    '完全犯罪を計画した善人の葛藤',
    '被害者が残した最後のメッセージ',
    '誰も傷つけたくなかった殺人者',
  ],
  恋愛: [
    '再会した初恋の人との一夜',
    '遠距離恋愛の最後の手紙',
    '失恋した翌朝の見知らぬ街',
    '友人の結婚式で気づく本当の気持ち',
    '別れた恋人の荷物を届ける日',
    '言えなかった一言を胸に抱えて生きる',
  ],
  ホラー: [
    '引っ越し先に残されていた日記',
    '笑顔が絶えない不気味な家族',
    '毎晩同じ夢を見る女の子の秘密',
    '消えたはずの友人からの電話',
    '鏡に映らない自分の影',
    '幼い頃に出会った友達の正体',
  ],
}

const FALLBACK_THEMES_DEFAULT = [
  '親に打ち明けられなかった夢',
  '雨の日に偶然再会した旧友',
  '捨てられなかった古い手紙の理由',
  '最後の列車を見送るホームの孤独',
  '十年越しで謝れた日の午後',
  '壊れかけた家族をつなぐ食卓',
  '誰にも見せたことのない日記帳',
  '引退した職人が作る最後の一品',
  '母の形見の指輪を売る決断',
  '故郷を離れた日に見た夕焼け',
]

export type AssignedTheme = { user_id: string; theme_text: string }

export async function assignThemesForMembers(
  genre: string,
  memberUserIds: string[],
  roomId?: string,
): Promise<AssignedTheme[]> {
  if (memberUserIds.length === 0) return []

  if (!process.env.ANTHROPIC_API_KEY) {
    return deterministicFallback(genre, memberUserIds, roomId)
  }

  const system = [
    'あなたは短い創作テーマを出題するアシスタントです。',
    '出力は厳密にJSONオブジェクトのみ。説明文は絶対禁止。',
    `キー "themes" に { "user_id": "<uuid>", "theme_text": "<10〜30文字の日本語>" } の配列。要素数は正確に ${memberUserIds.length}。`,
    'theme_text の条件（すべて必須）:',
    `  ・カテゴリ「${genre}」の世界観・雰囲気に強く関連していること`,
    '  ・登場人物の感情、状況、人間関係など具体的なイメージが湧く表現にすること',
    '  ・「〜の底」「〜の彼方」など単独では意味が曖昧な抽象名詞は使わない',
    '  ・固有名詞（地名・人名・作品名）は使わない',
    '  ・各プレイヤーのテーマは異なる方向性・対比が生まれるようにする',
    '  ・重複禁止',
    'user_id は次のUUIDのみを使うこと:',
    memberUserIds.join(', '),
  ].join('\n')

  try {
    const raw = await anthropicMessages({
      system,
      messages: [{ role: 'user', content: 'JSONのみで返答してください。' }],
      maxTokens: 800,
    })

    const json = extractJsonObject(raw)
    const arr = json?.themes as unknown
    if (!Array.isArray(arr) || arr.length !== memberUserIds.length) {
      return deterministicFallback(genre, memberUserIds, roomId)
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
      return deterministicFallback(genre, memberUserIds, roomId)
    }
    return out
  } catch {
    return deterministicFallback(genre, memberUserIds, roomId)
  }
}

function deterministicFallback(
  genre: string,
  memberUserIds: string[],
  roomId?: string,
): AssignedTheme[] {
  const pool = FALLBACK_THEMES_BY_GENRE[genre] ?? FALLBACK_THEMES_DEFAULT
  const seed = `${genre}:${roomId ?? ''}:${memberUserIds.join(',')}`
  const shuffled = shuffleWithSeed([...pool, ...FALLBACK_THEMES_DEFAULT], seed)
  const unique = Array.from(new Set(shuffled))
  return memberUserIds.map((user_id, i) => ({
    user_id,
    theme_text: unique[i % unique.length]!,
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
