-- プレイヤーごとのテーマ（C2/C3対応）
create table if not exists public.room_themes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  theme_text text not null check (char_length(theme_text) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.room_themes enable row level security;

-- 同じルームのメンバーはテーマを閲覧可能
create policy "room_themes: read room members" on public.room_themes
  for select using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_themes.room_id
        and rm.user_id = auth.uid()
    )
  );

-- 自分のテーマのみ作成・更新可能
create policy "room_themes: insert self" on public.room_themes
  for insert with check (auth.uid() = user_id);

create policy "room_themes: update self" on public.room_themes
  for update using (auth.uid() = user_id);

-- RealtimeでWaitingRoom/WritingRoomがリアルタイム更新できるよう追加
alter publication supabase_realtime add table public.room_themes;
