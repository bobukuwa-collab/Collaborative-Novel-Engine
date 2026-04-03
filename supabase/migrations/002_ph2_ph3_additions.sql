-- ============================================================
-- Ph.2 追加分: セッションRLSポリシー + Realtime
-- ============================================================

-- sessions: ルームメンバーはセッションを作成・更新可能
create policy "sessions: insert room members" on public.sessions
  for insert with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = sessions.room_id
        and rm.user_id = auth.uid()
    )
  );

create policy "sessions: update room members" on public.sessions
  for update using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = sessions.room_id
        and rm.user_id = auth.uid()
    )
  );

-- Realtime 有効化（ターン管理・リアルタイム更新に必要）
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.sentences;
alter publication supabase_realtime add table public.room_members;

-- ============================================================
-- Ph.3 追加分: novels RLSポリシー
-- ============================================================

-- novels: ルームメンバーは小説を作成可能（完結フロー）
create policy "novels: insert room members" on public.novels
  for insert with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = novels.room_id
        and rm.user_id = auth.uid()
    )
  );

-- novels: ルームメンバーは小説を更新可能
create policy "novels: update room members" on public.novels
  for update using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = novels.room_id
        and rm.user_id = auth.uid()
    )
  );
