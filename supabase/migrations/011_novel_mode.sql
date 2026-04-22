-- rooms.mode カラム追加（relay = 短句リレー, novel = 小説バトル）
alter table public.rooms
  add column if not exists mode text not null default 'relay'
    check (mode in ('relay', 'novel'));
