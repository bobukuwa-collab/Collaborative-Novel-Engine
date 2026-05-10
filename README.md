# Human × AI Novel Creator

AIと交互に文章を書いて小説を共作し、完成後に執筆の癖・思考の癖を「人格占い」としてAIが分析するWebアプリ。

## 機能

- **交互執筆**: あなた→AI→あなた…とターン制で物語を紡ぐ
- **人格占い**: 完成後、あなたが書いた文章からサイコパス度・共感力・想像力・闇度などを分析
- **ジャンル選択**: 10ジャンルから物語のテーマを選択
- **ライブラリ**: 完成した作品を公開・いいね・閲覧

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js 14 (App Router), Tailwind CSS, Framer Motion |
| バックエンド | Next.js Server Actions |
| データベース / 認証 | Supabase (PostgreSQL + Auth + Realtime) |
| AI | Google Gemini 2.0 Flash |
| テスト | Vitest, Testing Library |

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.local` を作成:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Supabase データベースのセットアップ

Supabase Dashboard の SQL Editor で以下を順番に実行:

1. `supabase/schema.sql` — テーブル・RLS ポリシーの作成
2. `supabase/trigger_new_user.sql` — 新規ユーザー自動作成トリガー

> **開発中**: Authentication → Settings → "Enable email confirmations" を OFF にすると確認メールなしでテストできます。

### 4. 開発サーバーの起動

```bash
# PowerShell では実行ポリシーのエラーが出る場合があるため cmd.exe を使用
cmd /c "pnpm dev"
```

ブラウザで `http://localhost:3000` を開く。

## テスト

```bash
pnpm test              # 単体テスト実行（47件）
pnpm test:coverage     # カバレッジレポート生成
```

## ディレクトリ構成

```
src/
├── app/               # Next.js App Router ページ
│   ├── (auth)/        # ログイン・サインアップ
│   ├── rooms/         # 執筆セッション
│   ├── novels/        # 完成作品・人格占い結果
│   └── library/       # 作品一覧
├── components/
│   ├── auth/          # LoginForm, SignupForm
│   ├── rooms/         # WritingRoom, CreateRoomForm
│   ├── novels/        # LibraryList, LikeButton, ContributionChart
│   └── personality/   # PersonalityCard
└── lib/
    ├── ai/            # Gemini API（continue-story, analyze-personality）
    ├── sessions/      # Server Actions（submitSentence, finishSession）
    ├── rooms/         # Server Actions（createRoom）
    ├── novels/        # Server Actions（toggleLike）
    └── supabase/      # クライアント・サーバー・管理者クライアント
supabase/
├── schema.sql         # DB スキーマ定義
└── trigger_new_user.sql  # 新規ユーザー自動作成トリガー
```

## 既知の制限・今後の課題

- [ ] Google OAuth ログイン（開発後期に追加予定）
- [ ] レートリミット（Upstash 等の導入）
- [ ] Supabase RLS ポリシーの監査・強化
- [ ] DB の `sentences(session_id, seq)` UNIQUE 制約追加
