-- ルーム: オープン戦 / 秘密テーマ対戦 + 最大ターン（早期終了・強制終了の目安）
alter table public.rooms
  add column if not exists game_mode text not null default 'open';

alter table public.rooms drop constraint if exists rooms_game_mode_check;
alter table public.rooms add constraint rooms_game_mode_check
  check (game_mode in ('open', 'secret_battle'));

alter table public.rooms
  add column if not exists max_turns int not null default 48;

alter table public.rooms drop constraint if exists rooms_max_turns_check;
alter table public.rooms add constraint rooms_max_turns_check
  check (max_turns between 5 and 200);

-- セッション: AI スコア・終了提案・採点間隔管理
alter table public.sessions
  add column if not exists max_turns int not null default 48;

alter table public.sessions
  add column if not exists coherence_score int null;

alter table public.sessions
  add column if not exists end_proposed boolean not null default false;

alter table public.sessions
  add column if not exists last_scored_turn int not null default -1;

alter table public.sessions drop column if exists ai_scores;

-- テーマ寄与スコア（秘密戦では自分の行のみ SELECT 可 → Realtime でも漏れにくい）
create table if not exists public.session_theme_scores (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  score int not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.session_theme_scores enable row level security;

create policy "session_theme_scores: read open or own" on public.session_theme_scores
  for select using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.sessions s
      inner join public.rooms r on r.id = s.room_id
      inner join public.room_members rm on rm.room_id = r.id and rm.user_id = auth.uid()
      where s.id = session_theme_scores.session_id
        and r.game_mode = 'open'
    )
  );

create policy "session_theme_scores: upsert self" on public.session_theme_scores
  for insert with check (auth.uid() = user_id);

create policy "session_theme_scores: update self" on public.session_theme_scores
  for update using (auth.uid() = user_id);

-- room_themes: オープンは全員閲覧、秘密戦は自分の行のみ
drop policy if exists "room_themes: read room members" on public.room_themes;

create policy "room_themes: select by game mode" on public.room_themes
  for select using (
    exists (
      select 1
      from public.room_members rm
      inner join public.rooms r on r.id = rm.room_id
      where rm.room_id = room_themes.room_id
        and rm.user_id = auth.uid()
        and (
          r.game_mode = 'open'
          or (r.game_mode = 'secret_battle' and room_themes.user_id = auth.uid())
        )
    )
  );

-- ライブラリのいいね数リアルタイム反映用（未追加の環境のみ）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes'
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_theme_scores'
  ) then
    alter publication supabase_realtime add table public.session_theme_scores;
  end if;
end $$;
