# Claude Code / AI エージェント向けメモ

## いまの作業ブランチ

- **`feature/backlog-meeting-2026-04-12`** … 2026-04-12 ミーティング反映のプロダクトバックログと後続実装の起点。

## 最初に読むファイル

1. **`.claude/handoffs/2026-04-12_product-backlog-meeting.md`** … 要求の整理、優先度、データモデル案、実装フェーズ順。
2. **`README.md`** … 技術スタック、デプロイ、既知課題、現行機能一覧。

## 触りやすいコードマップ

| 目的 | ファイル |
|------|-----------|
| ルーム作成・タイマー検証 | `src/lib/rooms/actions.ts`, `src/components/rooms/CreateRoomForm.tsx` |
| セッション・ターン | `src/lib/sessions/actions.ts`, `src/components/rooms/WritingRoom.tsx` |
| Realtime 購読の実例 | `WritingRoom.tsx`, `WaitingRoom.tsx` |
| テストの置き場 | `src/lib/**/__tests__/*.test.ts`, `vitest.config.ts` |

## 作業ルール（このリポジトリ）

- 生成コードは人間レビュー前提。シークレットはコードに含めない。
- 仕様が曖昧なときは handoff の「未決事項」を更新しつつ、小さな PR 単位で進める。
