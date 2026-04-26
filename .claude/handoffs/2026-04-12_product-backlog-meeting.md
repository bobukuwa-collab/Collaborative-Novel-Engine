# プロダクトバックログ整理（2026-04-12 ミーティング反映）

このドキュメントは `feature/backlog-meeting-2026-04-12` ブランチで開始する後続実装のための仕様メモである。Claude Code / 開発者は **実装前に本書と関連コード** を読むこと。

---

## 1. ブランチと目的

| 項目 | 内容 |
|------|------|
| ブランチ | `feature/backlog-meeting-2026-04-12` |
| 目的 | ミーティングで上がった課題を **優先度付きバックログ** に再構成し、ゲームルール変更（テーマ・終了条件・順番）と UX 改善の実装方針を固定する |
| リポジトリ | https://github.com/bobukuwa-collab/Collaborative-Novel-Engine |

---

## 2. 現状実装の要点（コードの入口）

| 領域 | 主なファイル | 備考 |
|------|----------------|------|
| ルーム作成・タイマー（30/60/90秒固定） | `src/lib/rooms/actions.ts`（Zod: `timer_seconds`）, `src/components/rooms/CreateRoomForm.tsx` | ホストの「自由な時間設定」はここを拡張 |
| セッション開始・`timer_end` | `src/lib/sessions/actions.ts` | DB の `sessions.timer_end` と連動 |
| 執筆ルーム・Realtime | `src/components/rooms/WritingRoom.tsx` | `postgres_changes` で `sessions` / `sentences` / `completion_votes` / `novels` を購読 |
| 待機ルーム | `src/components/rooms/WaitingRoom.tsx` | Realtime あり |
| 完結（投票） | `WritingRoom.tsx` の投票 UI、`voteToEnd` 等（`src/lib/novels/` 付近） | 新「AI＋進捗による自動完結」との住み分けが必要 |

**「自動更新がない」について:** 執筆画面は Supabase Realtime で更新されている。課題が指しているのは **ライブラリ一覧・待機中の一覧・ルーム外画面** など別画面の可能性がある。実装前に再現手順を確認し、不足箇所に `subscribe` または `router.refresh()` / ポーリングを追加する。

---

## 3. ミーティング項目の整理（バックログ）

### 3.1 体験・コンセプト

| ID | 元の声 | 整理した要求 | 優先度 |
|----|--------|----------------|--------|
| C1 | 小説の方がいいかも | 現状は「言葉のバトン」（短句・フレーズ寄り）。**長文連続・章立て・小説としての読み味** へ寄せるオプション（ルーム設定または別モード）を検討 | Should |
| C2 | テーマをもっと具体的にユーザーに決めさせる | カテゴリ選択だけでなく、**各参加者が具体的なテーマ文** を入力（または AI が下書き→ユーザーが確定） | Must（新ルールの前提） |
| C3 | お互いにテーマを決める／AI が決めてもよい。参加人数分のテーマ | **プレイヤーごとに 1 テーマ**（例: N 人なら N 個）。相互に相手のテーマへ寄せる「引き込み」が勝負の軸 | Must（コアゲームデザイン） |
| C4 | 勝敗を付けさせる → テーマに添えているか（AI 判断） | **各ターンまたはセッション終了時に AI が「誰のテーマへどれだけ寄ったか」** をスコア化。表示は簡易（％やコメント）からでも可 | Should（MVP サブセット可） |
| C5 | 順番ランダムになるパターン | ターン進行に **固定順 / ランダム順** をルーム設定で切替 | Could |

### 3.2 ルール・終了条件（AI 提案の統合）

| ID | 内容 | 整理した要求 | 優先度 |
|----|------|----------------|--------|
| E1 | 終わりがわからなくなる | 投票だけに依存せず、**進行状況が可視化**（例: 各テーマへの寄与メーター、推定残りターン） | Must |
| E2 | 自分のテーマに N％寄せられたら終了候補 | **テーマ適合度の閾値**（例: 全体に対する自分テーマへの寄与 ≥ X%）を 1 つの完了条件に | Should |
| E3 | 小説としての完成度が一定以上 | **AI が「構成・伏線・文体の粗」をスコア化**し閾値超えで完了候補。プロンプト設計とハルシネーション対策が課題 | Should |
| E4 | 文章の構成が課題 | 終了判定に加え、**任意で「次は展開／クライマックス向け」と UI ヒント**（AI 生成は任意・軽量から） | Could |

**推奨する終了モデル（案）:**  
「**投票（既存）** または **（テーマ適合度 AND 完成度スコア）が閾値を満たしたら自動完結提案 → ホスト／全員確認**」のハイブリッド。突然の強制終了は避け、初回は「提案＋投票」の方が安全。

### 3.3 UX・入力

| ID | 内容 | 整理した要求 | 優先度 |
|----|------|----------------|--------|
| U1 | 自動更新がない | 対象画面を特定し、Realtime または `revalidate` / クライアント更新を追加 | Must（再現確認後） |
| U2 | ホストが自由に時間設定 | `timer_seconds` を **数値入力または広いプリセット** に。サーバ側 Zod・DB 制約を同期 | Must |
| U3 | 音声入力 | 執筆テキストエリアに **Web Speech API** 等（ブラウザ差・権限・日本語認識） | Should |

---

## 4. データモデル変更の方向（実装時に詳細設計）

以下は **案** 。マイグレーション前にレビューすること。

- `rooms`: `turn_order_mode`（`fixed` | `random`）、`mode`（`relay` | `novel` | `theme_battle` など）、`timer_seconds` の範囲拡張
- 新規 `room_themes` または `player_themes`: `room_id`, `user_id`, `theme_text`, `source`（`user` | `ai`）, `confirmed_at`
- 新規 `ai_session_metrics`（または JSON カラム）: 直近の適合度・完成度スコア、更新時刻（レート制限・コスト管理用）
- 既存 `sessions` / `sentences` はターン進行の中心として維持し、**AI 判定はサーバアクションまたは Edge Function** で非同期実行を検討

---

## 5. 実装フェーズ案（Claude Code 向けワーク順）

> **2026-04-12 実装済み（`feature/backlog-meeting-2026-04-12`）**

| # | 内容 | 状態 | コミット概要 |
|---|------|------|------------|
| 1 | 調査：自動更新がない箇所を特定 | ✅ 完了 | `/library` と WritingRoom 外の画面が対象 |
| 2 | ホスト時間設定 (U2) | ✅ 完了 | `timer_seconds` 10〜600秒、プリセットボタン + 数値入力 UI |
| 3 | テーマ入力 C2/C3 | ✅ 完了 | `room_themes` テーブル、WaitingRoom フォーム、WritingRoom 表示 |
| 4 | ターン順ランダム C5 | ✅ 完了 | `turn_order_mode` カラム、session.id シードのクライアントシャッフル |
| 5 | AI 判定 C4/E2/E3 | ✅ 完了 | `score-session.ts`・`assign-themes.ts`、3ターンごとにバックグラウンドでスコアリング |
| 6 | 音声入力 U3 | ✅ 完了 | Web Speech API、ja-JP、マイク権限エラー表示 |
| 7 | 自動更新修正 U1 | ✅ 完了 | `revalidatePath('/library')` + LibraryList Realtime |
| 8 | 小説モード C1 | ✅ 完了 | `rooms.mode`（relay/novel）追加、段落表示・モード選択UI・フェーズヒント（E4） |

**DB マイグレーション適用済み（ローカル）:**
- `007_timer_range_and_turn_order.sql` — `timer_seconds` 制約緩和 + `turn_order_mode`
- `008_room_themes.sql` — `room_themes` テーブル新設
- `009_game_mode_ai_sessions.sql` — `game_mode`・`ai_session_metrics` 関連
- `010_char_limit_nullable_secret_default.sql` — `char_limit` nullable 化・`game_mode` デフォルト `secret_battle`
- `011_novel_mode.sql` — `rooms.mode`（relay/novel）カラム追加 ⚠️ **本番への適用が必要**

---

### 残タスク（次フェーズ）

**すべてのバックログ実装が完了しました。**

次の PR マージ前に確認すること:
1. `supabase/migrations/011_novel_mode.sql` を本番 Supabase に適用する
2. `ANTHROPIC_API_KEY` が本番 Cloud Run の Secret Manager に設定されていることを確認する
3. 本番でゲームを1セッション通しでテスト（秘密バトル・小説モード各1回）

---

## 6. 未決事項・リスク

- **AI コストとレイテンシ:** 毎ターン全文送信は高コスト。バッチ間隔・直近 K 文のみ送る等を設計に含める。
- **公平性・炎上対策:** 「AI が付けた勝敗」は説明文必須。誤判定時の手動上書きは将来検討。
- **著作権・ログ:** 外部 LLM に送るテキストの利用規約・オプトアウトを利用規約側で追記する余地あり。

---

## 7. 参照リンク

- 企画・進捗の一次情報: リポジトリ直下 `README.md`（実装進捗・既知課題）
- 本バックログを起点に PR を小さく分割し、`main` へはレビュー付きでマージすること。
