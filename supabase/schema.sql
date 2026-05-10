-- ============================================================
-- Human-AI Novel Creator - DB Schema
-- ============================================================

-- ENUMタイプ
create type room_status as enum ('in_progress', 'completed');
create type novel_status as enum ('in_progress', 'completed');

-- users（Supabase Auth連携）
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- rooms（シングルプレイヤー用に簡略化）
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  genre       text not null,
  max_turns   int  not null default 30,
  status      room_status not null default 'in_progress',
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now()
);

-- sessions
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  current_turn int  not null default 0,
  created_at   timestamptz not null default now()
);

-- sentences（author_type で人間/AI を区別）
create table public.sentences (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid references public.users(id),
  author_type text not null default 'human',
  content     text not null,
  seq         int  not null,
  created_at  timestamptz not null default now()
);

-- novels
create table public.novels (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  title        text not null default '無題の物語',
  status       novel_status not null default 'in_progress',
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- personality_profiles（人格占い結果）
create table public.personality_profiles (
  id                uuid primary key default gen_random_uuid(),
  novel_id          uuid not null references public.novels(id) on delete cascade,
  psychopathy_score int  not null default 0,
  empathy_score     int  not null default 0,
  imagination_score int  not null default 0,
  darkness_score    int  not null default 0,
  personality_type  text not null,
  character_title   text not null,
  analysis_text     text not null,
  created_at        timestamptz not null default now()
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

alter table public.users             enable row level security;
alter table public.rooms             enable row level security;
alter table public.sessions          enable row level security;
alter table public.sentences         enable row level security;
alter table public.novels            enable row level security;
alter table public.personality_profiles enable row level security;
alter table public.likes             enable row level security;

-- users
create policy "users: read own" on public.users
  for select using (auth.uid() = id);
create policy "users: insert own" on public.users
  for insert with check (auth.uid() = id);
create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- rooms
create policy "rooms: read own" on public.rooms
  for select using (auth.uid() = created_by);
create policy "rooms: insert own" on public.rooms
  for insert with check (auth.uid() = created_by);
create policy "rooms: update own" on public.rooms
  for update using (auth.uid() = created_by);

-- sessions
create policy "sessions: read own" on public.sessions
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = sessions.room_id and r.created_by = auth.uid()
    )
  );
create policy "sessions: insert own" on public.sessions
  for insert with check (
    exists (
      select 1 from public.rooms r
      where r.id = sessions.room_id and r.created_by = auth.uid()
    )
  );
create policy "sessions: update own" on public.sessions
  for update using (
    exists (
      select 1 from public.rooms r
      where r.id = sessions.room_id and r.created_by = auth.uid()
    )
  );

-- sentences: 自分のルームのみ読み書き可能（AI文もOK）
create policy "sentences: read own session" on public.sentences
  for select using (
    exists (
      select 1 from public.sessions s
      join public.rooms r on r.id = s.room_id
      where s.id = sentences.session_id and r.created_by = auth.uid()
    )
  );
create policy "sentences: insert own session" on public.sentences
  for insert with check (
    exists (
      select 1 from public.sessions s
      join public.rooms r on r.id = s.room_id
      where s.id = sentences.session_id and r.created_by = auth.uid()
    )
  );

-- novels: 完結作品は全員閲覧、自分のものは常に閲覧
create policy "novels: read published or own" on public.novels
  for select using (
    status = 'completed' or exists (
      select 1 from public.rooms r
      where r.id = novels.room_id and r.created_by = auth.uid()
    )
  );
create policy "novels: insert own" on public.novels
  for insert with check (
    exists (
      select 1 from public.rooms r
      where r.id = novels.room_id and r.created_by = auth.uid()
    )
  );
create policy "novels: update own" on public.novels
  for update using (
    exists (
      select 1 from public.rooms r
      where r.id = novels.room_id and r.created_by = auth.uid()
    )
  );

-- personality_profiles: 完結小説に紐付く
create policy "personality_profiles: read published" on public.personality_profiles
  for select using (
    exists (
      select 1 from public.novels n
      where n.id = personality_profiles.novel_id and n.status = 'completed'
    )
  );
create policy "personality_profiles: insert own" on public.personality_profiles
  for insert with check (
    exists (
      select 1 from public.novels n
      join public.rooms r on r.id = n.room_id
      where n.id = personality_profiles.novel_id and r.created_by = auth.uid()
    )
  );

-- likes
create policy "likes: read all" on public.likes
  for select using (auth.role() = 'authenticated');
create policy "likes: insert self" on public.likes
  for insert with check (auth.uid() = user_id);
create policy "likes: delete self" on public.likes
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.sentences;
