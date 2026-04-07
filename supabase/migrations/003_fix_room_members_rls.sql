-- ============================================================
-- room_members RLS修正
-- 問題: "read same room"ポリシーがroom_membersを自己参照しており
--        無限再帰が発生し不安定だった
-- 修正: 認証済みユーザーなら閲覧可能に変更（rooms: read allと統一）
-- ============================================================

-- 旧ポリシー削除（存在しない場合はスキップ）
drop policy if exists "room_members: read same room" on public.room_members;

-- 新ポリシー: 認証済みユーザーは全room_membersを閲覧可能（既存の場合は再作成）
drop policy if exists "room_members: read authenticated" on public.room_members;
create policy "room_members: read authenticated" on public.room_members
  for select using (auth.role() = 'authenticated');
