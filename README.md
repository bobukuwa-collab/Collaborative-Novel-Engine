[collaborative_novel_engine_企画書_v1.1.md](https://github.com/user-attachments/files/26380997/collaborative_novel_engine_._v1.1.md)
# 協調小説エンジン（Collaborative Novel Engine）
## 開発企画書 v1.3

| 項目 | 内容 |
|------|------|
| プロジェクト名 | 協調小説エンジン（Collaborative Novel Engine） |
| 作成日 | 2025年　　月　　日 |
| バージョン | v1.3 |
| 機密区分 | 社外秘 |
| ステータス | 更新済み（ホスティング未定・デプロイ前に確認） |

---

## 1. エグゼクティブサマリー

本企画は「協調小説エンジン（Collaborative Novel Engine）」のWebアプリケーションを、GitHub・Google Cloud・Cloud Build・Cursor・Claude Codeの統合開発環境によって最速8週間でMVPを出荷することを目的とした開発計画である。

> **プロジェクトのコアバリュー**
> 見知らぬ世界中のユーザーが、リアルタイムでタイマー制のターン交代方式により1文ずつ小説を共同執筆するWebアプリ。AIは「生成」ではなく「整合チェック・補完」の裏方に徹し、「人間が書いた共著小説」という価値を最大化する。

| MVP期間 | チーム規模 | 初期コスト（月額） | 最初の判断ゲート |
|--------|-----------|-----------------|----------------|
| 8週間 | 2名（フルスタック + デザイン） | 〜¥7,000 | Week 4末：UX検証 |

---

## 2. プロダクト概要

### 2-1. プロダクトビジョン

「一人では続かない創作を、見知らぬ誰かと完成させる体験」を提供する。創作コミュニティにおける孤独な執筆という課題に対し、リアルタイムのターン制共著という形式で解決する。

### 2-2. 主要機能（MVP スコープ）

- **ルーム作成・参加**：ジャンル / 人数 / 文字数制限を設定してURLで招待
- **リアルタイムターン制執筆**：30〜90秒タイマーで順番が回る緊張感のある共著
- **タイムアウト時スキップ**：MVPではAI代行なし（UX検証後に追加）
- **小説本文ビューア**：投稿された文を時系列でリアルタイム表示、著者を色で区別
- **完結フロー**：投票による完結判定、完結後は読み取り専用
- **貢献率可視化**：各著者の投稿文数・文字数を円グラフで表示
- **公開ライブラリ**：完結作品一覧・いいね機能

### 2-3. MVP対象外（v2以降）

- AI整合チェック（矛盾検出）
- AI代行投稿（文体クローン）
- 多言語クロス執筆ルーム
- ePub出力・マネタイズ機能

---

## 3. 技術スタック

### 3-1. 開発環境・ツール

| ツール | 用途 | 選定理由 |
|--------|------|---------|
| Cursor | メインIDE（AI補完） | Claude Codeと深く統合。AIペアプロで開発速度を最大化 |
| Claude Code | AIコーディングアシスタント | コード生成・レビュー・リファクタリングを自動化 |
| GitHub | ソースコード管理・CI/CD連携起点 | Cloud Buildとのネイティブ連携。PRベース開発フロー |
| Google Cloud Build | CI/CDパイプライン | GitHubプッシュ → 自動テスト → デプロイ（ホスティング先未定） |

### 3-2. フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 14（App Router） | SSR + CSR ハイブリッド。各種ホスティングに対応 |
| TypeScript | 5.x | 型安全性。Claude Codeとの親和性が高い |
| Tailwind CSS | 3.x | デザイン実装速度の最大化 |
| Framer Motion | 11.x | ターン切り替えアニメーション、投稿演出 |
| Recharts | 2.x | 貢献率グラフ（円グラフ・バーチャート） |

### 3-3. バックエンド・インフラ

| 技術 | サービス | 用途 |
|------|---------|------|
| Supabase | PostgreSQL + Auth + Realtime | DB・認証・WebSocketを一括管理。OSS |
| Upstash Redis | Serverless Redis | ターン状態・タイマーのリアルタイム管理 |
| ホスティング | 未定（デプロイ前に確認） | Next.js対応・WebSocket可能な環境を選定予定 |
| Google Cloud Build | CI/CDパイプライン | GitHub連携・自動テスト・デプロイ自動化 |

---

## 4. CI/CDパイプライン設計

### 4-1. 全体フロー

開発者がCursorでコードを編集し、Claude Codeによる補完・レビューを経てGitHubにプッシュすると、Google Cloud Buildが自動的にテスト・ビルド・デプロイを実行する。

| 順 | ステップ | 処理内容 | 使用ツール |
|----|---------|---------|-----------|
| 1 | コーディング | CursorでTypeScriptを実装。Claude Codeが補完・バグ検出 | Cursor + Claude Code |
| 2 | コミット & プッシュ | feature/ ブランチにプッシュ。PRを作成 | Git / GitHub |
| 3 | 自動トリガー | GitHub Webhookが Cloud Buildを起動 | Google Cloud Build |
| 4 | Lint / 型チェック | ESLint + TypeScript コンパイルチェック | Cloud Build Step |
| 5 | ユニットテスト | Vitest でコンポーネント・ロジックテスト | Cloud Build Step |
| 6 | ビルド | Next.js プロダクションビルド | Cloud Build Step |
| 7 | Dockerイメージ push | Artifact Registry にコンテナを保存 | Cloud Build / GCR |
| 8 | デプロイ | main → 本番環境 / develop → プレビュー環境（ホスティング先確定後に設定） | Cloud Build |
| 9 | 通知 | デプロイ結果をSlack / GitHub PRにコメント | Cloud Build Notifier |

### 4-2. ブランチ戦略

- **main**：本番環境（保護ブランチ。直接プッシュ不可）
- **develop**：ステージング環境。PRマージ時に自動デプロイ
- **feature/xxx**：機能開発ブランチ。PRレビュー後にdevelopへマージ
- **hotfix/xxx**：本番バグ修正ブランチ。mainへ直接マージ後developにも反映

### 4-3. cloudbuild.yaml 構成イメージ

```yaml
steps:
  - name: 'node:20'
    entrypoint: 'npm'
    args: ['ci']                          # 依存関係インストール

  - name: 'node:20'
    entrypoint: 'npm'
    args: ['run', 'lint']                 # ESLint

  - name: 'node:20'
    entrypoint: 'npm'
    args: ['run', 'test']                 # Vitest

  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '$_IMAGE', '.'] # Docker build

  # デプロイステップはホスティング先確定後に追記

substitutions:
  _IMAGE: 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/novel/api:$SHORT_SHA'

options:
  logging: CLOUD_LOGGING_ONLY
```

---

## 5. 開発ロードマップ（8週間MVP）

| フェーズ | 期間 | 主要タスク | 完了判定基準 |
|---------|------|-----------|------------|
| Ph.1 | Week 1–2 | Next.js + Supabase初期化 / 認証 / ルーム作成 / DBスキーマ設計 | 友人が30秒以内に入室できる |
| Ph.2 | Week 3–4 | WebSocket（Supabase Realtime）/ ターン管理（Redis）/ タイマーUI / 小説ビューア | 3人で1文ずつリレーできる |
| Ph.3 | Week 5–6 | 完結フロー / 貢献率グラフ / 公開ライブラリ / AI整合（任意） | 完結作品をURLでシェアできる |
| Ph.4 | Week 7–8 | バグ修正 / クローズドβ（20名）/ UXインタビュー / KPI計測 | NPS +20 / 続行判断材料が揃う |

> **Week 4末 判断ゲート（Go / No-Go）**
> 「面白い！もう1回やりたい」と発言した人が3人中2人以上いること。この基準を満たさない場合はUXの根本的な見直しを行う。満たした場合はPh.3へ即移行。

---

## 6. Cursor + Claude Code 活用方針

### 6-1. 活用シーン

| シーン | 具体的な使い方 |
|--------|-------------|
| コンポーネント生成 | 「タイマーUIコンポーネントをTailwind + Framer Motionで作成して」とClaude Codeに指示 |
| DBスキーマ → 型生成 | `supabase gen types typescript` でSupabase型を自動生成、Claude Codeが型エラーを修正 |
| WebSocketロジック | Supabase Realtimeのチャンネル実装をClaude Codeにペアプロしてもらう |
| テストコード生成 | 実装後「このコンポーネントのVitestテストを書いて」でユニットテストを自動生成 |
| コードレビュー | PR前にClaude Codeで「セキュリティ・パフォーマンスの観点でレビューして」 |
| リファクタリング | 「このファイルをより読みやすくリファクタリングして」で可読性を向上 |

### 6-2. Claude Code 利用ルール

- 生成コードは必ずレビューしてからコミットする（盲目的なペーストは禁止）
- 機密情報（APIキー・パスワード）はClaude Codeに渡さない。環境変数で管理
- 生成されたテストは実際に実行し、グリーンであることを確認してからマージ
- Claude Codeへの指示はコメントとして残し、意思決定の根拠を追跡可能にする

---

## 7. データベース設計（主要テーブル）

| テーブル名 | 主要カラム | 型 | 説明 |
|-----------|-----------|-----|------|
| users | id, display_name, avatar_url | uuid, text, text | 認証ユーザー（Supabase Auth連携） |
| rooms | id, genre, max_players, char_limit, status | uuid, text, int, int, enum | 執筆ルームの設定・状態管理 |
| room_members | room_id, user_id, join_order, color | uuid, uuid, int, text | ルーム参加者と順番・色の割り当て |
| sessions | id, room_id, current_turn, timer_end | uuid, uuid, int, timestamptz | 現在の執筆セッション・ターン状態（Redis併用） |
| sentences | id, session_id, user_id, content, seq | uuid, uuid, uuid, text, int | 投稿された1文ずつのレコード（本文の本体） |
| novels | id, room_id, title, status, published_at | uuid, uuid, text, enum, timestamptz | 完結した共著小説（公開ライブラリの元データ） |
| likes | user_id, novel_id, created_at | uuid, uuid, timestamptz | ライブラリのいいね（複合PK） |

---

## 8. セキュリティ・品質方針

### 8-1. セキュリティ

- **Supabase RLS（Row Level Security）**：参加者のみがルームデータを読み書き可能
- **環境変数管理**：APIキーはGoogle Cloud Secret Managerで管理。コードベースに含めない
- **入力バリデーション**：Zodスキーマで全入力を検証。XSSはNext.jsのデフォルトエスケープで防止
- **認証**：Supabase Auth（JWT）。セッション有効期限1時間・リフレッシュトークン7日
- **レートリミット**：Upstash Redis + Ratelimitでターン投稿のスパム防止

### 8-2. 品質基準

| 指標 | MVP目標値 | 計測方法 |
|------|---------|---------|
| ターン切り替えレイテンシ | < 500ms（P95） | Supabase Metrics / PostHog |
| セッション完結率 | > 60% | PostHog カスタムイベント |
| ユニットテストカバレッジ | > 60% | Vitest + coverage-v8 |
| Lighthouse スコア | > 85（モバイル） | Cloud Build Step で自動計測 |

---

## 9. コスト試算

### 9-1. MVP期間（月額概算）

| サービス | 月額概算 | 備考 |
|---------|---------|------|
| Supabase Free | ¥0 | DB 500MB / 月5万MAU / β期間は無料枠内 |
| Upstash Redis | ¥0〜500 | 月1万コマンド無料。β期間（20名）は無料枠内 |
| Google Cloud Build | ¥500〜2,000 | 120分/日無料。超過分のみ従量 |
| ホスティング | 未定 | デプロイ前にオーナーへ確認・承認を得てから設定 |
| Claude API（任意・AI機能） | ¥0（Week5以降） | Week5以降に追加する場合のみ |
| **合計（ホスティング除く・AI機能なし）** | **〜¥500〜2,000/月** | β期間（20名規模）の概算 |

> **コスト最適化方針**
> Supabase Free・Upstash無料枠を活用してβ期間のインフラコストを最小化。ホスティングはデプロイ前にオーナーへ選択肢と費用を提示し、承認を得てから設定する。スケール時は Supabase Free → Pro（$25）への移行ラインを MAU 5万人超過を目安に設定する。

---

## 10. リスクと対策

| リスク | レベル | 対策 |
|--------|--------|------|
| コールドスタート（ユーザー不足） | 高 | βはAIをダミープレイヤーとして充填。カクヨム・pixivコミュニティから手動招待 |
| 荒らし・不適切投稿 | 高 | 投稿前のモデレーションAI導入（Claude API）。レピュテーションスコア制 |
| WebSocket接続不安定 | 中 | 切断時のターン状態をRedisで保全。再接続時に自動復帰するロジックを実装 |
| 著作権・共著権の帰属 | 中 | 利用規約でCC BY-SA相当ライセンスを採用。商用利用は全著者の同意を必須化 |
| Claude Code依存によるコード品質低下 | 低 | 生成コードの必須レビュールール徹底。CIでLint・型チェック・テストを自動実行 |

---

## 11. 成功指標（KPI）

### 11-1. MVPフェーズ（8週間）

- クローズドβ完了率：20名が最低1セッション完結 → 目標100%参加
- セッション完結率：開始したセッションの60%以上が完結まで到達
- リピート率：β期間中に2回以上セッションに参加したユーザーが50%以上
- NPS（Net Promoter Score）：+20以上
- 週次バグ件数：Week8時点でCritical/High バグ 0件

### 11-2. v1.0リリース後（3ヶ月）

- DAU（日次アクティブユーザー）：500人
- 月間完結小説数：200作品
- SNSシェア率：完結作品の20%以上が外部SNSでシェアされる
- Proプラン転換率：3%以上（月980円）

---

## 12. 次のアクション

| # | アクション | 担当 | 期限 |
|---|-----------|------|------|
| 1 | 本企画書のレビュー・承認 | プロジェクトオーナー | 着手後3日以内 |
| 2 | GitHub Organization作成 / リポジトリ設計 | フルスタックエンジニア | Week1 Day1 |
| 3 | Google Cloud プロジェクト作成 / Cloud Build 接続 | フルスタックエンジニア | Week1 Day2 |
| 4 | Supabase プロジェクト作成 / DBスキーマ実装 | フルスタックエンジニア | Week1 Day3–4 |
| 5 | Cursor + Claude Code 環境セットアップ（全メンバー） | 全員 | Week1 Day1 |
| 6 | ホスティング先の選定・確認（コスト承認後に設定） | プロジェクトオーナー | Week7（デプロイ前） |
| 7 | UIデザインワイヤーフレーム作成（5画面） | デザイナー | Week1 末 |
| 8 | クローズドβ招待リスト作成（20名） | 全員 | Week6 末 |

---

## 13. 実装進捗（2026-04-07時点）

### 完了済み

| フェーズ | 内容 |
|---------|------|
| Ph.1 | Next.js 14 + Supabase 初期化、Google認証・メール認証、ルーム作成・招待リンク |
| Ph.2 | Supabase Realtimeによるターン制執筆、タイマー・タイムアウト自動送信、フレーズビューア |
| Ph.3 | 完成フロー（投票制・過半数で自動完成）、貢献率グラフ（recharts PieChart）、コレクション、いいね |
| Ph.4 | Vitestユニットテスト28件・CIに組込、Lighthouse CI、RLS修正、6文字ルームコード参加機能 |
| CI/CD | Google Cloud Build → Artifact Registry → Cloud Run 自動デプロイ + Lighthouse計測 |
| インフラ | Cloud Run（`--min-instances=0` でランニングコスト¥0）、Secret Manager |
| コンセプト | 「協調小説」→「**言葉のバトン**」にピボット。短句・名言・ポエム向けに刷新 |

**本番URL**: https://collaborative-novel-f3hfydm6ta-an.a.run.app

### 主要機能（現在の実装）

| 機能 | 詳細 |
|------|------|
| ルームコード参加 | 6文字コードで別アカウントから簡単参加（/join ページ） |
| タイマー設定 | ルーム作成時に30/60/90秒を選択可能 |
| タイムアウト自動送信 | 時間切れ時、入力中のテキストを自動送信（空なら自動スキップ） |
| 投票制完成 | 全員に投票ボタン。2人→全員・3人以上→過半数で自動完成 |
| 書籍デザイン | 完成作品はアンバー系・セリフ体の書籍風デザインで表示 |
| カテゴリ10種 | 愛と恋・自然と季節・哲学と人生・夢と希望・ユーモア・孤独と静寂・友情と仲間・宇宙と神秘・食と日常・ランダム |

### 既知の課題・TODO

| 優先度 | 課題 | 対応方針 |
|--------|------|---------|
| 低 | Framer Motionによるターン切り替えアニメーション未実装 | v2対応 |
| 低 | AI整合チェック・AI代行投稿 | v2対応 |
| 低 | Lighthouse スコア計測結果の確認・チューニング | 次回CI確認 |

### 技術的決定事項（計画からの変更点）

| 項目 | 計画 | 実際 |
|------|------|------|
| ホスティング | 未定 | Google Cloud Run（min-instances=0） |
| Redis（ターン管理） | Upstash Redis | 不使用（Supabase sessionsテーブルで代替） |
| タイマー管理 | Redis | DBのtimer_endカラム + クライアントサイドカウントダウン |
| 完結方式 | ホストのみ | 投票制（過半数・全員一致） |
| コンセプト | 協調小説 | 言葉のバトン（短句・名言・ポエム） |

---

## 承認欄

| 項目 | 内容 |
|------|------|
| 承認者 | |
| 承認日 | 　　　年　　月　　日 |
| フィードバック | |
