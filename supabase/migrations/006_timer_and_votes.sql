-- ① タイマー秒数をルームに追加
alter table public.rooms
  add column if not exists timer_seconds int not null default 60
  check (timer_seconds in (30, 60, 90));

-- ② 完結投票テーブル
create table if not exists public.completion_votes (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.completion_votes enable row level security;

create policy "completion_votes: read authenticated" on public.completion_votes
  for select using (auth.role() = 'authenticated');

create policy "completion_votes: insert self" on public.completion_votes
  for insert with check (auth.uid() = user_id);

-- Realtimeに追加（WritingRoomで投票状況をリアルタイム表示するため）
alter publication supabase_realtime add table public.completion_votes;
