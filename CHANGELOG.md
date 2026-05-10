# Changelog

## [0.1.0] - 2026-05-10

### Added
- 人間とAIの交互執筆システム（偶数ターン=人間、奇数ターン=AI自動生成）
- Google Gemini 2.0 Flash による物語の続き自動生成
- 完成後の人格占い機能（サイコパス度・共感力・想像力・闇度・タイプ称号）
- メール/パスワード認証（Supabase Auth）
- 執筆ルーム作成（ジャンル10種・ターン数選択）
- Supabase Realtime によるリアルタイム同期 + 3秒ポーリングフォールバック
- 物語フェーズ表示（導入 / 展開 / クライマックス / 結末）
- 完成作品ライブラリといいね機能
- 新規ユーザー自動作成 DB トリガー（`security definer`）

### Security
- ユーザー入力をプロンプトインジェクション対策のデリミタタグで囲む（Gemini呼び出し）
- genre をフリーテキストから `z.enum` ホワイトリストに変更
- `finishSession` に sessionId → roomId 帰属確認を追加（IDOR 防止）
- いいね対象を公開済み作品のみに制限

### Fixed
- AI生成失敗時のターン状態不整合 → try/catch + `current_turn` ロールバック実装
- AI文章の seq 競合 → `aiSeq = humanSeq + 1` で決定論的に算出
- AI ターン更新に楽観的ロック追加（`.eq('current_turn', humanTurn)`）
- Realtime payload の型アサーション → 型ガード関数に変更
- ポーリングによる Realtime 追加済み文章の上書き → 件数チェックで防止
- Google OAuth 未設定時のサインアップエラー → 開発段階ではメール認証のみに絞る
