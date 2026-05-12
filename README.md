# Collaborative Novel Engine

> 見知らぬ世界中のユーザーが、リアルタイムで1文ずつ小説を共同執筆するWebアプリ。

タイマー制のターン交代で緊張感のある共著体験を提供する。各プレイヤーが秘密のテーマを持ち寄り、AIがどちらのテーマへ物語が寄ったかをスコアリングする「テーマバトルモード」を中核に据える。

---

## プロダクトコンセプト

### コアループ

```
ルーム作成（テーマ設定）→ 招待・参加 → タイマー制ターン交代執筆
→ 完結投票（全員一致で完結）→ AIによるテーマ適合スコア発表 → ライブラリ公開
```

### ターゲットユーザー

創作が好きで、見知らぬ誰かと言葉をつなぐ体験に価値を感じる人。年齢・国籍不問。

---

## 機能

### 実装済み ✅

| 機能 | 概要 |
|------|------|
| ルーム作成・参加 | ジャンル / ターン上限 / タイマー秒数 / 対戦モードを設定。招待コードで参加 |
| テーマバトルモード | 各プレイヤーが秘密テーマを設定。AIが3ターンごとにテーマ適合度をスコアリング |
| リアルタイム執筆 | Supabase Realtime による即時同期 + 3秒ポーリングフォールバック |
| ターン順ランダム | ルーム設定で固定順 / ランダム順を切り替え |
| タイマー設定 | 10〜600秒でホストが自由に設定 |
| 物語フェーズヒント | 導入 / 展開 / クライマックス / 結末の進行状況をUIで表示 |
| 完結投票 | 各プレイヤーが投票（ターン消費なし・取り消し可）。全員一致で自動完結 |
| AI完成度スコア | 3ターンごとにAIが物語の coherence を採点し、理由をリアルタイム表示 |
| 音声入力 | Web Speech API による日本語音声入力対応 |
| フレンド機能 | 申請・承認・解除。フレンドのプロフィール・作品閲覧、ルーム招待 |
| 公開ライブラリ | 完結作品の一覧公開・いいね機能 |
| テストログイン | 開発環境でワンクリックログイン（3テストユーザー） |

### 実装予定 🔧

| 機能 | 優先度 |
|------|--------|
| フレンドへのルーム招待通知 | 高 |
| AI による矛盾検出・補完（代行投稿） | 中 |
| Google OAuth ログイン | 中 |
| レートリミット（Upstash Redis） | 中 |
| ePub 出力 | 低 |

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| バックエンド | Next.js Server Actions |
| データベース / 認証 | Supabase (PostgreSQL + Auth + Realtime) |
| AI — 執筆継続 | Google Gemini 2.0 Flash |
| AI — スコアリング | Anthropic Claude 3.5 Haiku |
| テスト | Vitest |
| CI / CD | Google Cloud Build → Vercel |

---

## Supabase について

### 役割

このアプリでは Supabase が3つの役割を担っています。

| 役割 | 内容 |
|------|------|
| **データベース** | PostgreSQL。rooms / sessions / sentences / novels / users など全データを保存 |
| **認証 (Auth)** | メール＋パスワードでのログイン・サインアップ。JWT トークンでセッション管理 |
| **Realtime** | WebSocket で DB の変更をリアルタイム配信。執筆中の文章が相手の画面に即座に反映される |

### 料金プラン

| プラン | 料金 | 主な制限 |
|--------|------|---------|
| **Free** | 無料 | DB 500MB、MAU 5万人、Realtime 200万通/月 |
| **Pro** | $25/月（約3,800円） | DB 8GB、MAU 無制限（5万超は +$0.003/人）、Realtime 500万通/月 |
| **Team** | $599/月 | 大規模チーム向け |

### このアプリの使用量試算

| リソース | 試算 | Free 上限 |
|---------|------|-----------|
| DB ストレージ | 1作品 ≈ 10KB、1,000作品完結で ≈ 10MB | 500MB（約5万作品分） |
| MAU | 小規模ローンチ時は数百〜数千人規模 | 5万人まで無料 |
| Realtime | 1セッション ≈ 40通、月1,000セッションで ≈ 4万通 | 200万通/月 |

**結論: MAU が5万人を超えるまでは無料プランで運用可能。超えた時点で Pro（月 $25）に移行する。**

---

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.local` を作成（`.env.example` を参照）:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> `ANTHROPIC_API_KEY` は AI スコアリング機能（3ターンごとの完成度採点）に必要。未設定でも執筆は動作するが採点は無効になる。

### 3. Supabase データベースのセットアップ

Supabase Dashboard の **SQL Editor** で以下を順番に実行:

```
supabase/schema.sql               # テーブル・RLS の基本定義
supabase/trigger_new_user.sql     # 新規ユーザー自動作成トリガー
supabase/migrations/001〜015.sql  # 機能追加マイグレーション（番号順）
```

> **開発中**: Authentication → Settings → "Enable email confirmations" を **OFF** にするとメール確認なしでテストできる。

### 4. テストユーザーの作成（開発環境のみ）

`SUPABASE_SERVICE_ROLE_KEY` を設定後、一度だけ実行:

```bash
node scripts/seed-test-users.mjs
```

3人のテストユーザー（`test1〜3@collab-novel.dev`）が作成される。ログイン画面にワンクリックログインボタンが表示される。

### 5. 開発サーバーの起動

```bash
pnpm dev
```

`http://localhost:3000` をブラウザで開く。

---

## テスト

```bash
pnpm test            # 単体テスト実行（59件）
pnpm test:coverage   # カバレッジレポート生成
```

---

## ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/        # ログイン・サインアップ
│   ├── rooms/         # ルーム作成・待機室・執筆セッション
│   ├── novels/        # 完成作品ビューア
│   ├── library/       # 公開ライブラリ
│   ├── friends/       # フレンド一覧・申請管理
│   └── users/[id]/    # ユーザープロフィール
├── components/
│   ├── auth/          # LoginForm, SignupForm
│   ├── rooms/         # WritingRoom, WaitingRoom, CreateRoomForm
│   ├── novels/        # LibraryList, LikeButton, ContributionChart
│   ├── friends/       # FriendButton, FriendList, PendingRequests
│   └── layout/        # Header
└── lib/
    ├── ai/            # continue-story, analyze-personality, score-session
    ├── sessions/      # submitSentence, finishSession, toggleCompletionVote
    ├── rooms/         # createRoom
    ├── novels/        # toggleLike
    ├── friends/       # sendFriendRequest, acceptFriendRequest, ...
    └── supabase/      # client, server, admin
supabase/
├── schema.sql
├── trigger_new_user.sql
└── migrations/        # 001〜015（番号順に適用）
scripts/
└── seed-test-users.mjs  # テストユーザー作成スクリプト
```

---

## 進捗ログ

| 日付 | マイルストーン |
|------|-------------|
| 2026-03-31 | Next.js + Supabase 初期化・認証・ルーム作成・DB スキーマ（Ph.1 完了） |
| 2026-04-12 | バックログミーティング反映（テーマバトル・ランダム順・タイマー拡張・音声入力・小説モード） |
| 2026-04-22〜26 | 小説バトルモード全実装・AI採点・バトル演出・UI全面改善 |
| 2026-05-10 | Gemini AI 統合・人格分析・Cloud Run デプロイ設定 |
| 2026-05-11 | **完結投票バグ修正**（投票がターンを消費しなくなった）|
| 2026-05-11 | **AI完成度の理由付け**（coherence スコア + 根拠テキストをリアルタイム表示） |
| 2026-05-11 | **フレンド機能**（申請・承認・プロフィールページ・ルーム招待基盤） |

---

## 関連リポジトリ

| リポジトリ | 説明 |
|-----------|------|
| [bobukuwa-collab/anima](https://github.com/bobukuwa-collab/anima) | 一人でAIと執筆し人格診断を受けるソロ体験アプリ（別プロダクト） |
