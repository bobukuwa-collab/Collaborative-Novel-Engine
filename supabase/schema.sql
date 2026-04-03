-- ============================================================
-- Collaborative Novel Engine - DB Schema
-- ============================================================

-- ENUMタイプ
create type room_status as enum ('waiting', 'in_progress', 'completed');
create type novel_status as enum ('in_progress', 'completed');

-- users（Supabase Auth連携）
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- rooms
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  genre       text not null,
  max_players int  not null check (max_players between 2 and 8),
  char_limit  int  not null check (char_limit between 20 and 200),
  status      room_status not null default 'waiting',
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now()
);

-- room_members
create table public.room_members (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  join_order int  not null,
  color      text not null,
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- sessions
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  current_turn int  not null default 0,
  timer_end    timestamptz,
  created_at   timestamptz not null default now()
);

-- sentences
create table public.sentences (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.users(id),
  content    text not null,
  seq        int  not null,
  created_at timestamptz not null default now()
);

-- novels
create table public.novels (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  title        text not null default '無題の共著小説',
  status       novel_status not null default 'in_progress',
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- likes
create table public.likes (
  user_id    uuid not null references public.users(id) on delete cascade,
  novel_id   uuid not null references public.novels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, novel_id)
);

-- ============================================================
-- RLS（Row Level Security）
-- ============================================================

alter table public.users        enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.sessions     enable row level security;
alter table public.sentences    enable row level security;
alter table public.novels       enable row level security;
alter table public.likes        enable row level security;

-- users: 自分のレコードのみ読み書き可能
create policy "users: read own" on public.users
  for select using (auth.uid() = id);
create policy "users: insert own" on public.users
  for insert with check (auth.uid() = id);
create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- rooms: 認証済みユーザーは作成・参加中ルームは閲覧可能
create policy "rooms: read all" on public.rooms
  for select using (auth.role() = 'authenticated');
create policy "rooms: insert authenticated" on public.rooms
  for insert with check (auth.uid() = created_by);
create policy "rooms: update by creator" on public.rooms
  for update using (auth.uid() = created_by);

-- room_members: 同ルームのメンバーのみ閲覧可能
create policy "room_members: read same room" on public.room_members
  for select using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id
        and rm.user_id = auth.uid()
    )
  );
create policy "room_members: insert self" on public.room_members
  for insert with check (auth.uid() = user_id);

-- sessions: 同ルームのメンバーのみ閲覧可能
create policy "sessions: read room members" on public.sessions
  for select using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = sessions.room_id
        and rm.user_id = auth.uid()
    )
  );

-- sentences: 同セッションのルームメンバーのみ閲覧・投稿可能
create policy "sentences: read room members" on public.sentences
  for select using (
    exists (
      select 1 from public.sessions s
      join public.room_members rm on rm.room_id = s.room_id
      where s.id = sentences.session_id
        and rm.user_id = auth.uid()
    )
  );
create policy "sentences: insert self" on public.sentences
  for insert with check (auth.uid() = user_id);

-- novels: 完結作品は全員閲覧可能
create policy "novels: read published" on public.novels
  for select using (status = 'completed' or exists (
    select 1 from public.room_members rm
    where rm.room_id = novels.room_id
      and rm.user_id = auth.uid()
  ));

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

-- likes: 認証済みユーザーは閲覧・いいね可能
create policy "likes: read all" on public.likes
  for select using (auth.role() = 'authenticated');
create policy "likes: insert self" on public.likes
  for insert with check (auth.uid() = user_id);
create policy "likes: delete self" on public.likes
  for delete using (auth.uid() = user_id);

-- sessions: ルームメンバーはセッションを作成・更新可能（Ph.2追加）
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

-- ============================================================
-- Realtime有効化（ターン管理に必要）
-- ============================================================
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.sentences;
alter publication supabase_realtime add table public.room_members;
