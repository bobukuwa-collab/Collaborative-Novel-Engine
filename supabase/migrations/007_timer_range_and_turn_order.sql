-- ① タイマー秒数の制約を緩和（10〜600秒の任意値）
alter table public.rooms drop constraint if exists rooms_timer_seconds_check;
alter table public.rooms add constraint rooms_timer_seconds_check
  check (timer_seconds between 10 and 600);

-- ② ターン順モードをroomsに追加（fixed=固定順 / random=ランダム順）
alter table public.rooms
  add column if not exists turn_order_mode text not null default 'fixed'
  check (turn_order_mode in ('fixed', 'random'));
