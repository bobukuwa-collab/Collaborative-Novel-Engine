-- relay モードを廃止し、全ルームを novel に統一
update public.rooms set mode = 'novel' where mode = 'relay';

-- mode カラムの制約を novel のみに変更
alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check check (mode = 'novel');
alter table public.rooms alter column mode set default 'novel';
