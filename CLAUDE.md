# Claude Code / AI エージェント向けメモ

## プロジェクト概要

**Collaborative Novel Engine** — 見知らぬユーザー同士がリアルタイムでタイマー制ターン交代により1文ずつ小説を共同執筆するWebアプリ。各プレイヤーが秘密テーマを設定し、AIがテーマ適合度と物語完成度をスコアリングする「テーマバトルモード」が中核。

※ 同社の **anima**（`bobukuwa-collab/anima`）はソロで AIと執筆し人格診断を受けるアプリ。別プロダクトなので混同しないこと。

## 現在の作業ブランチ

- **`feature/meeting-2026-05-11`** … 2026-05-11 ミーティング課題（完結投票バグ修正・AI理由付け・フレンド機能）の実装。PRレビュー・本番マイグレーション適用待ち。

## 最初に読むファイル

1. **`README.md`** … 機能一覧、技術スタック、セットアップ手順、進捗ログ
2. **`.claude/handoffs/2026-04-12_product-backlog-meeting.md`** … バックログ・実装済みタスクの詳細

## コードマップ

| 目的 | ファイル |
|------|---------|
| ルーム作成・バリデーション | `src/lib/rooms/actions.ts`, `src/components/rooms/CreateRoomForm.tsx` |
| セッション・ターン進行 | `src/lib/sessions/actions.ts` |
| 完結投票トグル | `src/lib/sessions/actions.ts` → `toggleCompletionVote` |
| 執筆画面（Realtime） | `src/components/rooms/WritingRoom.tsx` |
| AI 執筆継続（Gemini） | `src/lib/ai/continue-story.ts` |
| AI スコアリング（Anthropic） | `src/lib/ai/score-session.ts` |
| フレンド機能 | `src/lib/friends/actions.ts`, `src/components/friends/` |
| DB マイグレーション | `supabase/migrations/001〜015.sql`（番号順に適用） |
| テスト | `src/lib/**/__tests__/*.test.ts` |

## 作業ルール（このリポジトリ）

- 生成コードは人間レビュー前提。シークレットはコードに含めない。
- DB 変更は必ず `supabase/migrations/` に連番 SQL を追加する（次は `016_`）。
- 仕様が曖昧なときはブランチの PR コメントか handoff に未決事項を記録し、小さな PR 単位で進める。
- anima リポジトリには一切手を加えない。
