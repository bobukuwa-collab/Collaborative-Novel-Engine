-- rooms テーブルにルームコード列を追加
alter table public.rooms add column if not exists join_code text;

-- 既存ルームにコードを仮付与（UUIDの先頭6文字を大文字化）
update public.rooms
set join_code = upper(replace(substring(id::text, 1, 8), '-', ''))
where join_code is null;

-- NOT NULL + UNIQUE 制約
alter table public.rooms alter column join_code set not null;
alter table public.rooms add constraint rooms_join_code_unique unique (join_code);
