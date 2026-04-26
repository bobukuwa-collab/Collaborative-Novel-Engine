-- char_limit を nullable に変更（NULL = 無制限、コード側で1000文字上限）
alter table public.rooms alter column char_limit drop not null;
alter table public.rooms alter column char_limit drop default;
alter table public.rooms alter column char_limit set default null;

-- char_limit の範囲制約を更新（NULL許容・1〜1000）
alter table public.rooms drop constraint if exists rooms_char_limit_check;
alter table public.rooms add constraint rooms_char_limit_check
  check (char_limit is null or (char_limit >= 1 and char_limit <= 1000));

-- game_mode のデフォルトを secret_battle に変更
alter table public.rooms alter column game_mode set default 'secret_battle';
