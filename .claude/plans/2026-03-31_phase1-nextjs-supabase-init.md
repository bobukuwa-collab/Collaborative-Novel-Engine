# Phase 1: Next.js + Supabase 初期化 / 認証 / ルーム作成 / DBスキーマ設計

**作成日**: 2026-03-31  
**ステータス**: 🟡 進行中  
**最終更新**: 2026-03-31 00:00

## 概要

協調小説エンジン（Collaborative Novel Engine）の Phase 1（Week 1-2）実装計画。
ゴールは「友人が30秒以内に入室できる」状態の実現。
Next.js 14 App Router プロジェクトの初期化、Supabase によるDB/認証/RLS構築、
ルーム作成・参加フローの完成までをカバーする。

---

## 前提条件（実装開始前に必要なもの）

### アカウント・サービス
| サービス | 必要なもの | 取得先 |
|---------|-----------|--------|
| GitHub | Organization `bobukuwa-collab` のWrite権限 | 既存 |
| Supabase | プロジェクト作成（リージョン: ap-northeast-1 推奨） | https://supabase.com |
| Vercel | チームアカウント + GitHub連携 | https://vercel.com |
| Upstash | Redisインスタンス作成（Phase 2で使うが環境変数だけ先に用意） | https://upstash.com |
| Google Cloud | プロジェクト作成 + Cloud Build API 有効化 | https://console.cloud.google.com |

### 環境変数一覧（.env.local）
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx...
```

### ローカル開発環境
- Node.js 20.x LTS
- pnpm 9.x（パッケージマネージャ）
- Supabase CLI (`npx supabase init` で利用)
- Git 設定済み

---

## ディレクトリ構造（Next.js App Router 準拠）

```
collaborative-novel-engine/
├── .github/
│   └── workflows/           # GitHub Actions（将来Cloud Buildに移行）
├── .claude/
│   └── plans/               # 実装計画ファイル
├── supabase/
│   ├── migrations/          # DBマイグレーションSQL
│   │   ├── 00001_create_users_profile.sql
│   │   ├── 00002_create_rooms.sql
│   │   ├── 00003_create_room_members.sql
│   │   ├── 00004_create_sessions.sql
│   │   ├── 00005_create_sentences.sql
│   │   ├── 00006_create_novels.sql
│   │   └── 00007_create_likes.sql
│   ├── seed.sql             # 開発用シードデータ
│   └── config.toml          # Supabase CLI設定
├── src/
│   ├── app/
│   │   ├── layout.tsx       # ルートレイアウト（Providers, フォント）
│   │   ├── page.tsx         # トップページ（ルーム一覧 or LP）
│   │   ├── globals.css      # Tailwind @import
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── callback/
│   │   │       └── route.ts # Supabase Auth コールバック
│   │   ├── rooms/
│   │   │   ├── page.tsx         # ルーム一覧
│   │   │   ├── new/
│   │   │   │   └── page.tsx     # ルーム作成フォーム
│   │   │   └── [roomId]/
│   │   │       ├── page.tsx     # ルーム詳細（待機室 / セッション）
│   │   │       └── layout.tsx   # ルーム固有レイアウト
│   │   └── api/
│   │       └── rooms/
│   │           ├── route.ts         # POST: ルーム作成
│   │           └── [roomId]/
│   │               ├── route.ts     # GET: ルーム詳細
│   │               └── join/
│   │                   └── route.ts # POST: ルーム参加
│   ├── components/
│   │   ├── ui/                  # 汎用UIコンポーネント
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── avatar.tsx
│   │   │   └── loading-spinner.tsx
│   │   ├── auth/
│   │   │   ├── auth-form.tsx        # ログイン/サインアップフォーム
│   │   │   ├── auth-provider.tsx    # 認証コンテキスト
│   │   │   └── protected-route.tsx  # 認証ガード
│   │   └── rooms/
│   │       ├── room-card.tsx        # ルーム一覧のカード
│   │       ├── room-create-form.tsx # ルーム作成フォーム
│   │       ├── room-member-list.tsx # 参加者リスト
│   │       └── room-invite-link.tsx # 招待リンクコピー
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # ブラウザ用クライアント
│   │   │   ├── server.ts        # サーバー用クライアント
│   │   │   ├── middleware.ts    # セッション更新ミドルウェア
│   │   │   └── types.ts         # supabase gen types の出力
│   │   ├── validations/
│   │   │   ├── room.ts          # ルーム関連Zodスキーマ
│   │   │   └── auth.ts          # 認証関連Zodスキーマ
│   │   ├── constants.ts         # 定数（ジャンル一覧、色一覧など）
│   │   └── utils.ts             # ユーティリティ関数
│   ├── hooks/
│   │   ├── use-auth.ts          # 認証状態フック
│   │   └── use-room.ts          # ルーム状態フック
│   └── types/
│       ├── database.ts          # DB型定義（generated）
│       ├── room.ts              # ルームドメイン型
│       └── user.ts              # ユーザードメイン型
├── tests/
│   ├── setup.ts                 # Vitest セットアップ
│   ├── lib/
│   │   └── validations/
│   │       ├── room.test.ts
│   │       └── auth.test.ts
│   ├── components/
│   │   └── rooms/
│   │       └── room-create-form.test.tsx
│   └── api/
│       └── rooms/
│           └── route.test.ts
├── .env.local.example           # 環境変数テンプレート
├── .gitignore
├── .eslintrc.json
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── next.config.mjs
├── middleware.ts                 # Next.js ミドルウェア（認証セッション管理）
├── package.json
└── pnpm-lock.yaml
```

---

## Week 1: プロジェクト基盤構築（Day 1-5）

### Day 1: プロジェクト初期化 + 開発環境セットアップ

- [ ] **T1.1** Next.js 14 プロジェクト作成（pnpm create next-app）
  - Action: `pnpm create next-app@latest collaborative-novel-engine --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - Dependencies: Node.js 20.x, pnpm インストール済み
  - Risk: Low

- [ ] **T1.2** 追加パッケージインストール
  - Action: `pnpm add @supabase/supabase-js @supabase/ssr zod framer-motion`
  - Action: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node`
  - Dependencies: T1.1
  - Risk: Low

- [ ] **T1.3** ESLint + Prettier 設定
  - Action: `.eslintrc.json` にTypeScript strict ルール追加、Prettier連携
  - Dependencies: T1.1
  - Risk: Low

- [ ] **T1.4** Vitest 設定
  - File: `vitest.config.ts`, `tests/setup.ts`
  - Action: React Testing Library + jsdom 環境設定、パスエイリアス設定
  - Dependencies: T1.2
  - Risk: Low

- [ ] **T1.5** Git リポジトリ接続 + ブランチ戦略設定
  - Action: `git remote set-url origin https://github.com/bobukuwa-collab/Collaborative-Novel-Engine.git`
  - Action: main ブランチを保護、develop ブランチ作成、feature/phase1-init ブランチで作業開始
  - Dependencies: T1.1
  - Risk: Low

- [ ] **T1.6** .env.local.example 作成 + .gitignore 更新
  - Action: 全環境変数のテンプレート作成、.env.local を .gitignore に追加確認
  - Dependencies: T1.1
  - Risk: Low

- [ ] **T1.7** Vercel プロジェクト接続
  - Action: Vercel CLI で GitHub リポジトリをリンク、develop ブランチをプレビュー環境に設定
  - Dependencies: T1.5, Vercel アカウント
  - Risk: Low

### Day 2: Supabase プロジェクト作成 + DBスキーマ設計

- [ ] **T2.1** Supabase プロジェクト作成
  - Action: Supabase ダッシュボードでプロジェクト作成（リージョン: ap-northeast-1）
  - Action: API URL と anon key を .env.local に設定
  - Dependencies: Supabase アカウント
  - Risk: Low

- [ ] **T2.2** Supabase CLI 初期化
  - Action: `npx supabase init` でローカル設定生成
  - Action: `npx supabase link --project-ref <ref>` でリモート接続
  - Dependencies: T2.1
  - Risk: Low

- [ ] **T2.3** マイグレーション: users プロファイルテーブル
  - File: `supabase/migrations/00001_create_users_profile.sql`
  - Action: Supabase Auth の `auth.users` を拡張する `public.users` テーブル作成
  - Columns: `id (uuid PK ref auth.users)`, `display_name (text NOT NULL)`, `avatar_url (text)`, `created_at`, `updated_at`
  - Action: Auth ユーザー作成時に自動で public.users にレコードを作る trigger 関数
  - Dependencies: T2.2
  - Risk: Medium（trigger の動作確認が必要）

- [ ] **T2.4** マイグレーション: rooms テーブル
  - File: `supabase/migrations/00002_create_rooms.sql`
  - Action: `rooms` テーブル作成
  - Columns: `id (uuid PK default gen_random_uuid())`, `owner_id (uuid ref users)`, `title (text)`, `genre (text NOT NULL)`, `max_players (int NOT NULL default 4 CHECK 2-8)`, `char_limit (int NOT NULL default 100 CHECK 10-500)`, `status (room_status enum: 'waiting','active','finished' default 'waiting')`, `invite_code (text UNIQUE NOT NULL)`, `created_at`, `updated_at`
  - Dependencies: T2.3
  - Risk: Low

- [ ] **T2.5** マイグレーション: room_members テーブル
  - File: `supabase/migrations/00003_create_room_members.sql`
  - Columns: `id (uuid PK)`, `room_id (uuid ref rooms ON DELETE CASCADE)`, `user_id (uuid ref users)`, `join_order (int NOT NULL)`, `color (text NOT NULL)`, `joined_at (timestamptz default now())`
  - Constraint: UNIQUE(room_id, user_id), UNIQUE(room_id, join_order)
  - Dependencies: T2.4
  - Risk: Low

- [ ] **T2.6** マイグレーション: sessions, sentences テーブル
  - File: `supabase/migrations/00004_create_sessions.sql`, `00005_create_sentences.sql`
  - Action: Phase 2 で本格利用するが、スキーマは先に作成しておく
  - Dependencies: T2.5
  - Risk: Low

- [ ] **T2.7** マイグレーション: novels, likes テーブル
  - File: `supabase/migrations/00006_create_novels.sql`, `00007_create_likes.sql`
  - Action: Phase 3 で本格利用するが、スキーマは先に作成しておく
  - Dependencies: T2.6
  - Risk: Low

- [ ] **T2.8** マイグレーション実行 + 型生成
  - Action: `npx supabase db push` でリモートDBにマイグレーション適用
  - Action: `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
  - Dependencies: T2.3-T2.7
  - Risk: Medium（マイグレーションエラーの可能性）

### Day 3: RLS（Row Level Security）+ Supabase クライアント設定

- [ ] **T3.1** RLS ポリシー: users テーブル
  - File: `supabase/migrations/00008_rls_users.sql`
  - Policies:
    - SELECT: 全認証ユーザーが全プロファイルを閲覧可能
    - UPDATE: 自分のプロファイルのみ更新可能
    - INSERT: trigger 経由のみ（サービスロール）
  - Dependencies: T2.8
  - Risk: Medium

- [ ] **T3.2** RLS ポリシー: rooms テーブル
  - File: `supabase/migrations/00009_rls_rooms.sql`
  - Policies:
    - SELECT: 全認証ユーザーが閲覧可能（公開ルーム一覧のため）
    - INSERT: 認証済みユーザーが作成可能（owner_id = auth.uid()）
    - UPDATE: オーナーのみ更新可能
    - DELETE: オーナーのみ削除可能（status = 'waiting' の場合のみ）
  - Dependencies: T2.8
  - Risk: Medium

- [ ] **T3.3** RLS ポリシー: room_members テーブル
  - File: `supabase/migrations/00010_rls_room_members.sql`
  - Policies:
    - SELECT: 同じルームのメンバーが閲覧可能
    - INSERT: 認証済みユーザーが自分自身を追加可能（user_id = auth.uid()）かつルームが 'waiting' 状態かつ max_players 未満
    - DELETE: 自分自身のみ退出可能 or ルームオーナーがキック可能
  - Dependencies: T2.8
  - Risk: High（条件付きINSERTのRLSは複雑）

- [ ] **T3.4** Supabase クライアント設定（ブラウザ用）
  - File: `src/lib/supabase/client.ts`
  - Action: `@supabase/ssr` の `createBrowserClient` を使用
  - Dependencies: T1.2, T2.1
  - Risk: Low

- [ ] **T3.5** Supabase クライアント設定（サーバー用）
  - File: `src/lib/supabase/server.ts`
  - Action: `@supabase/ssr` の `createServerClient` を cookies で使用（App Router対応）
  - Dependencies: T1.2, T2.1
  - Risk: Low

- [ ] **T3.6** Next.js ミドルウェア（セッション管理）
  - File: `middleware.ts`
  - Action: 全リクエストで Supabase セッションを更新、未認証ユーザーを /login にリダイレクト（/rooms/* パス）
  - Dependencies: T3.5
  - Risk: Medium

- [ ] **T3.7** RLS マイグレーション実行 + 動作確認
  - Action: `npx supabase db push`
  - Action: Supabase ダッシュボードの SQL Editor で RLS 動作を手動テスト
  - Dependencies: T3.1-T3.3
  - Risk: Medium

### Day 4: 認証フロー実装

- [ ] **T4.1** Zod バリデーションスキーマ（認証）
  - File: `src/lib/validations/auth.ts`
  - Action: email/password のバリデーションスキーマ定義
  - Dependencies: T1.2
  - Risk: Low

- [ ] **T4.2** バリデーションテスト作成（TDD: RED）
  - File: `tests/lib/validations/auth.test.ts`
  - Action: 正常系・異常系のテストケース作成
  - Dependencies: T4.1, T1.4
  - Risk: Low

- [ ] **T4.3** 認証プロバイダーコンポーネント
  - File: `src/components/auth/auth-provider.tsx`
  - Action: Supabase Auth の onAuthStateChange をリッスンするコンテキストプロバイダー
  - Dependencies: T3.4
  - Risk: Low

- [ ] **T4.4** 認証フォームコンポーネント
  - File: `src/components/auth/auth-form.tsx`
  - Action: メール+パスワードのログイン/サインアップフォーム（Tailwind CSS）
  - Action: Zod バリデーション適用、エラーメッセージ表示
  - Dependencies: T4.1, T4.3
  - Risk: Low

- [ ] **T4.5** ログインページ + サインアップページ
  - Files: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
  - Action: AuthForm コンポーネントを配置、ページ間リンク
  - Dependencies: T4.4
  - Risk: Low

- [ ] **T4.6** Auth コールバック Route Handler
  - File: `src/app/(auth)/callback/route.ts`
  - Action: Supabase Auth のOAuthコールバック処理（メール確認後リダイレクト）
  - Dependencies: T3.5
  - Risk: Medium

- [ ] **T4.7** 認証ガードコンポーネント
  - File: `src/components/auth/protected-route.tsx`
  - Action: 未認証時にログインページへリダイレクトするラッパー
  - Dependencies: T4.3
  - Risk: Low

- [ ] **T4.8** ルートレイアウトに AuthProvider 組み込み
  - File: `src/app/layout.tsx`
  - Action: AuthProvider でアプリ全体をラップ、フォント・Tailwind 設定
  - Dependencies: T4.3
  - Risk: Low

- [ ] **T4.9** 認証フロー E2E 手動テスト
  - Action: サインアップ -> メール確認 -> ログイン -> /rooms へリダイレクト確認
  - Dependencies: T4.5, T4.6, T3.6
  - Risk: Medium

### Day 5: 共通UIコンポーネント + レイアウト仕上げ

- [ ] **T5.1** 汎用UIコンポーネント作成
  - Files: `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `avatar.tsx`, `loading-spinner.tsx`
  - Action: Tailwind CSS で再利用可能なUIプリミティブを作成
  - Action: variants パターン（primary, secondary, outline, ghost）
  - Dependencies: T1.1
  - Risk: Low

- [ ] **T5.2** ナビゲーションバー
  - File: `src/components/ui/navbar.tsx`
  - Action: ロゴ、ユーザーアバター、ログアウトボタン
  - Dependencies: T5.1, T4.3
  - Risk: Low

- [ ] **T5.3** トップページ（ルーム一覧への導線）
  - File: `src/app/page.tsx`
  - Action: 未認証時はLP風ヒーロー、認証時は /rooms へリダイレクト
  - Dependencies: T5.1, T4.3
  - Risk: Low

- [ ] **T5.4** 定数定義
  - File: `src/lib/constants.ts`
  - Action: ジャンル一覧（ファンタジー、SF、恋愛、ホラー、日常、その他）、メンバー色一覧（8色）、文字数制限の範囲
  - Dependencies: None
  - Risk: Low

- [ ] **T5.5** ユーティリティ関数
  - File: `src/lib/utils.ts`
  - Action: `cn()` (clsx + tailwind-merge)、`generateInviteCode()`、`formatDate()` 等
  - Dependencies: None
  - Risk: Low

- [ ] **T5.6** Week 1 成果コミット + PR作成
  - Action: feature/phase1-init -> develop PR作成
  - Action: 動作確認項目: プロジェクト起動、認証フロー、DB接続
  - Dependencies: T5.1-T5.5
  - Risk: Low

---

## Week 2: ルーム作成・参加フロー完成（Day 1-5）

### Day 1 (W2): ルーム作成フロー

- [ ] **T6.1** Zod バリデーションスキーマ（ルーム）
  - File: `src/lib/validations/room.ts`
  - Action: ルーム作成のバリデーション（title, genre, max_players: 2-8, char_limit: 10-500）
  - Dependencies: T1.2
  - Risk: Low

- [ ] **T6.2** バリデーションテスト作成（TDD: RED -> GREEN）
  - File: `tests/lib/validations/room.test.ts`
  - Action: 正常系・境界値・異常系テスト
  - Dependencies: T6.1, T1.4
  - Risk: Low

- [ ] **T6.3** ルーム作成 API Route Handler
  - File: `src/app/api/rooms/route.ts`
  - Action: POST - Zod バリデーション -> Supabase insert -> invite_code 自動生成 -> レスポンス
  - Action: 認証チェック（サーバーサイド Supabase クライアント）
  - Dependencies: T6.1, T3.5, T2.4
  - Risk: Medium

- [ ] **T6.4** ルーム作成フォームコンポーネント
  - File: `src/components/rooms/room-create-form.tsx`
  - Action: ジャンル選択（ドロップダウン）、人数スライダー、文字数制限入力、タイトル入力
  - Action: フォーム送信 -> API呼び出し -> 作成完了後 /rooms/[roomId] にリダイレクト
  - Dependencies: T6.1, T5.1
  - Risk: Low

- [ ] **T6.5** ルーム作成ページ
  - File: `src/app/rooms/new/page.tsx`
  - Action: ProtectedRoute でラップ、RoomCreateForm を配置
  - Dependencies: T6.4, T4.7
  - Risk: Low

### Day 2 (W2): ルーム参加フロー

- [ ] **T7.1** ルーム参加 API Route Handler
  - File: `src/app/api/rooms/[roomId]/join/route.ts`
  - Action: POST - ルーム存在確認 -> status='waiting' 確認 -> max_players 確認 -> room_members insert -> join_order と color 自動割り当て
  - Action: 既に参加済みの場合は既存メンバー情報を返す（冪等性）
  - Dependencies: T3.5, T2.5
  - Risk: Medium（同時参加の競合状態に注意）

- [ ] **T7.2** ルーム参加（invite_code経由）
  - File: `src/app/api/rooms/[roomId]/route.ts`
  - Action: GET - invite_code からルーム情報取得 + メンバー一覧取得
  - Dependencies: T3.5
  - Risk: Low

- [ ] **T7.3** 招待リンクコンポーネント
  - File: `src/components/rooms/room-invite-link.tsx`
  - Action: `{APP_URL}/rooms/{roomId}?invite={invite_code}` をクリップボードにコピー
  - Action: コピー完了のフィードバックアニメーション（Framer Motion）
  - Dependencies: T5.1
  - Risk: Low

- [ ] **T7.4** 招待リンクからの自動参加ロジック
  - File: `src/app/rooms/[roomId]/page.tsx` 内
  - Action: URLクエリパラメータに invite_code がある場合、自動で参加APIを呼び出し
  - Action: 未認証の場合はログインページへリダイレクト（リダイレクト先を保持）
  - Dependencies: T7.1, T3.6
  - Risk: Medium

### Day 3 (W2): ルーム待機室UI

- [ ] **T8.1** ルーム詳細ページ（待機室）
  - File: `src/app/rooms/[roomId]/page.tsx`
  - Action: ルーム情報表示（タイトル、ジャンル、設定）、参加者リスト、招待リンク、開始ボタン（オーナーのみ）
  - Dependencies: T7.2, T7.4
  - Risk: Low

- [ ] **T8.2** 参加者リストコンポーネント
  - File: `src/components/rooms/room-member-list.tsx`
  - Action: 参加者のアバター、名前、割り当て色を表示
  - Action: join_order 順にソート
  - Dependencies: T5.1
  - Risk: Low

- [ ] **T8.3** Supabase Realtime: room_members 変更監視
  - File: `src/hooks/use-room.ts`
  - Action: room_members テーブルの INSERT/DELETE を Realtime で監視
  - Action: 新メンバー参加時にリストをリアルタイム更新
  - Dependencies: T3.4, T8.2
  - Risk: Medium（Realtime のチャンネル管理）

- [ ] **T8.4** ルームカードコンポーネント
  - File: `src/components/rooms/room-card.tsx`
  - Action: ルーム一覧用カード（タイトル、ジャンル、参加人数/最大人数、ステータスバッジ）
  - Dependencies: T5.1
  - Risk: Low

- [ ] **T8.5** ルーム一覧ページ
  - File: `src/app/rooms/page.tsx`
  - Action: 自分が参加中のルーム一覧 + 「新しいルームを作成」ボタン
  - Dependencies: T8.4, T3.5
  - Risk: Low

### Day 4 (W2): テスト + セキュリティ強化

- [ ] **T9.1** API Route Handler テスト
  - File: `tests/api/rooms/route.test.ts`
  - Action: ルーム作成APIの単体テスト（Supabase クライアントをモック）
  - Action: 正常系、バリデーションエラー、認証エラーのケース
  - Dependencies: T6.3, T1.4
  - Risk: Medium

- [ ] **T9.2** コンポーネントテスト
  - File: `tests/components/rooms/room-create-form.test.tsx`
  - Action: フォームバリデーション、送信動作のテスト
  - Dependencies: T6.4, T1.4
  - Risk: Medium

- [ ] **T9.3** RLS ポリシー検証テスト
  - Action: Supabase ダッシュボードの SQL Editor で以下を検証:
    - 未認証ユーザーがルーム作成できないこと
    - 他ユーザーのプロファイルを更新できないこと
    - max_players を超えてルームに参加できないこと
    - 'active' 状態のルームに新規参加できないこと
  - Dependencies: T3.7
  - Risk: Medium

- [ ] **T9.4** エラーハンドリング統一
  - File: `src/lib/utils.ts` にエラー変換ユーティリティ追加
  - Action: Supabase エラーをユーザーフレンドリーなメッセージに変換
  - Action: APIレスポンスを `ApiResponse<T>` 型で統一
  - Dependencies: T6.3, T7.1
  - Risk: Low

- [ ] **T9.5** 入力サニタイゼーション確認
  - Action: ルームタイトル、ユーザー名などの入力で XSS が発生しないことを確認
  - Action: Next.js のデフォルトエスケープが有効であることを検証
  - Dependencies: T8.1
  - Risk: Low

### Day 5 (W2): 統合テスト + デプロイ + 検証

- [ ] **T10.1** E2E 手動テストシナリオ実行
  - Action: 以下のシナリオを手動テスト:
    1. ユーザーA: サインアップ -> ルーム作成 -> 招待リンクコピー
    2. ユーザーB: 招待リンクアクセス -> サインアップ -> 自動参加
    3. ユーザーA: リアルタイムでユーザーBの参加を確認
    4. 全体: 30秒以内に完了できるか計測
  - Dependencies: 全Week2タスク
  - Risk: Medium

- [ ] **T10.2** Vercel プレビューデプロイ
  - Action: develop ブランチにマージ -> Vercel プレビュー環境で動作確認
  - Action: Supabase の環境変数を Vercel に設定
  - Dependencies: T10.1
  - Risk: Medium

- [ ] **T10.3** Google Cloud Build 設定
  - File: `cloudbuild.yaml`
  - Action: lint -> type-check -> test -> build のパイプライン作成
  - Action: GitHub トリガー設定
  - Dependencies: T1.3, T1.4
  - Risk: Medium

- [ ] **T10.4** シードデータ作成
  - File: `supabase/seed.sql`
  - Action: 開発用テストユーザー2名、テストルーム1つのシードデータ
  - Dependencies: T2.8
  - Risk: Low

- [ ] **T10.5** Phase 1 完了 PR作成 + マージ
  - Action: feature/phase1-rooms -> develop PR作成
  - Action: チェックリスト確認: 認証OK、ルーム作成OK、参加OK、リアルタイム更新OK、30秒以内入室OK
  - Dependencies: T10.1-T10.4
  - Risk: Low

---

## 依存関係グラフ（簡易）

```
T1.1 (Next.js init)
 ├── T1.2 (packages) ── T1.4 (Vitest)
 ├── T1.3 (ESLint)
 ├── T1.5 (Git)
 ├── T1.6 (.env)
 └── T1.7 (Vercel)

T2.1 (Supabase project)
 └── T2.2 (CLI) ── T2.3→T2.4→T2.5→T2.6→T2.7→T2.8 (migrations)

T2.8 + T1.2
 ├── T3.1→T3.2→T3.3→T3.7 (RLS)
 ├── T3.4 (browser client)
 ├── T3.5 (server client) ── T3.6 (middleware)
 └── T4.1→T4.4→T4.5 (auth UI)

T3.4 + T4.3
 └── T4.8 (layout) ── T4.9 (auth e2e)

T6.1 + T3.5
 └── T6.3 (room API) ── T6.4→T6.5 (room create UI)

T3.5 + T2.5
 └── T7.1 (join API) ── T7.4 (auto-join)

T8.1-T8.5 (room UI) ── T9.1-T9.5 (tests) ── T10.1-T10.5 (deploy)
```

---

## リスク・依存関係

| 重要度 | 内容 |
|--------|------|
| HIGH | RLS ポリシーの room_members INSERT 条件（max_players チェック）が Supabase RLS 内で完結できるか。サブクエリが必要になり、パフォーマンスに影響する可能性あり。代替案: API側でチェック + RLS は基本的な認証のみ |
| HIGH | Supabase Realtime の room_members 監視が RLS を通過するか。Realtime は RLS を考慮するが、ポリシーの設計ミスでイベントが届かないリスク |
| MEDIUM | 招待リンクからの自動参加フロー（未認証→認証→参加）のリダイレクト先保持。Next.js middleware + searchParams で実現可能だが、テストが複雑 |
| MEDIUM | Supabase のローカル開発環境（Docker）を使うか、リモートのみで開発するか。MVP速度優先でリモートのみを推奨するが、チーム開発時は問題になりうる |
| LOW | pnpm と Vercel の互換性。Vercel は pnpm をネイティブサポートしているため問題ないが、確認が必要 |

---

## ブロッカー・難題ログ
<!-- 対応困難な課題が発生したらここに追記 -->
| 日時 | 課題 | 影響フェーズ | 状態 |
|------|------|------------|------|

---

## 成功基準（Phase 1 完了条件）

- [ ] Next.js 14 App Router プロジェクトが起動し、Vercel にデプロイできる
- [ ] メール+パスワードでサインアップ・ログインできる
- [ ] ルームを作成し、招待リンクを生成できる
- [ ] 招待リンクから別ユーザーがルームに参加できる
- [ ] 参加がリアルタイムで反映される（Supabase Realtime）
- [ ] RLS により自分のデータのみ変更可能
- [ ] 全DBテーブル（7テーブル）のスキーマが作成済み
- [ ] 「友人が30秒以内に入室できる」ことを実測で確認
- [ ] Vitest テストが通る（バリデーション + API のユニットテスト）
- [ ] CI パイプライン（Cloud Build）が動作する

---

## 進捗ログ

| 日時 | 更新内容 |
|------|--------|
| 2026-03-31 00:00 | プラン作成 |
