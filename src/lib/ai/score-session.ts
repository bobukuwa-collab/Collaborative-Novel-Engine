import { anthropicMessages } from '@/lib/ai/anthropic'

export type ThemeRow = { user_id: string; theme_text: string }

export type ScoreResult = {
  scores: Record<string, number>
  coherence: number
}

const SCORE_INTERVAL = 3

export function shouldScoreTurn(newTurnIndex: number, lastScoredTurn: number): boolean {
  return newTurnIndex > 0 && newTurnIndex % SCORE_INTERVAL === 0 && newTurnIndex !== lastScoredTurn
}

/**
 * 直近の本文と各プレイヤーテーマから、テーマ寄与度(0-100)と簡易完成度(0-100)を推定する。
 */
export async function scoreSessionText(params: {
  storyText: string
  themes: ThemeRow[]
}): Promise<ScoreResult> {
  const { storyText, themes } = params
  const baseScores: Record<string, number> = {}
  for (const t of themes) {
    baseScores[t.user_id] = 0
  }

  if (!storyText.trim() || themes.length === 0) {
    return { scores: baseScores, coherence: 0 }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicScores(storyText, themes)
  }

  const themeLines = themes.map((t) => `- ${t.user_id}: ${t.theme_text}`).join('\n')
  const system = [
    '短い共著小説の断片を評価する審査員です。',
    '厳密にJSONのみ。説明禁止。',
    'キー: "scores" (user_id uuid をキー、0〜100の整数値), "coherence" (0〜100、物語としてのつながり・破綻の少なさ)。',
    'scores のキーは次の user_id のみ:',
    themes.map((t) => t.user_id).join(', '),
  ].join('\n')

  const raw = await anthropicMessages({
    system,
    messages: [
      {
        role: 'user',
        content: `テーマ一覧:\n${themeLines}\n\n本文:\n${storyText.slice(-4000)}`,
      },
    ],
    maxTokens: 500,
  })

  const json = extractJsonObject(raw)
  const scoresObj = json?.scores as Record<string, unknown> | undefined
  const coherenceRaw = json?.coherence
  const scores: Record<string, number> = { ...baseScores }
  if (scoresObj && typeof scoresObj === 'object') {
    for (const t of themes) {
      const v = scoresObj[t.user_id]
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) {
        scores[t.user_id] = Math.max(0, Math.min(100, Math.round(n)))
      }
    }
  }
  const coherence = typeof coherenceRaw === 'number' && Number.isFinite(coherenceRaw)
    ? Math.max(0, Math.min(100, Math.round(coherenceRaw)))
    : 40

  return { scores, coherence }
}

function heuristicScores(storyText: string, themes: ThemeRow[]): ScoreResult {
  const scores: Record<string, number> = {}
  const lower = storyText.toLowerCase()
  for (const t of themes) {
    const words = t.theme_text.split(/[\s、。]+/).filter((w) => w.length >= 2)
    let hit = 0
    for (const w of words) {
      if (storyText.includes(w) || lower.includes(w.toLowerCase())) hit++
    }
    scores[t.user_id] = Math.min(100, hit * 25 + 5)
  }
  const coherence = Math.min(100, Math.floor(storyText.length / 20) + 20)
  return { scores, coherence }
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

export const THEME_SCORE_INTERVAL = SCORE_INTERVAL
