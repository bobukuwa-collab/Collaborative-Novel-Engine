-- novels テーブルを Realtime に追加
-- 完結時に非ホストユーザーへリダイレクトシグナルを送るために必要
alter publication supabase_realtime add table public.novels;
