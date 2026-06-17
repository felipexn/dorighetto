create extension if not exists pgcrypto;

do $$ begin
  create type "UserRole" as enum ('ADMIN', 'LEITOR');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type "EntryType" as enum ('ENTRADA', 'SAIDA');
exception
  when duplicate_object then null;
end $$;

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role "UserRole" not null default 'LEITOR',
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create table if not exists financial_sheets (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  purpose text,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create table if not exists financial_entries (
  id text primary key default gen_random_uuid()::text,
  sheet_id text not null references financial_sheets(id) on delete cascade,
  date timestamp(3) not null,
  type "EntryType" not null,
  item text not null,
  quantity text,
  value numeric(14, 2) not null,
  notes text,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create index if not exists financial_entries_sheet_id_date_idx
  on financial_entries(sheet_id, date);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_users_updated_at on users;
create trigger touch_users_updated_at
before update on users
for each row execute function touch_updated_at();

drop trigger if exists touch_financial_sheets_updated_at on financial_sheets;
create trigger touch_financial_sheets_updated_at
before update on financial_sheets
for each row execute function touch_updated_at();

drop trigger if exists touch_financial_entries_updated_at on financial_entries;
create trigger touch_financial_entries_updated_at
before update on financial_entries
for each row execute function touch_updated_at();

create table if not exists drilling_records (
  id text primary key,
  date timestamp(3) not null,
  team_name text not null,
  machine_name text not null,
  bank_name text not null,
  activity_code text not null,
  shift text not null default 'DIA',
  motor_start text not null,
  motor_end text not null,
  notes text,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create table if not exists drilling_holes (
  id text primary key,
  record_id text not null references drilling_records(id) on delete cascade,
  hole_code text not null,
  meters numeric(10, 2) not null,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create table if not exists drilling_downtimes (
  id text primary key,
  record_id text not null references drilling_records(id) on delete cascade,
  reason text not null,
  hours numeric(8, 2) not null,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

alter table drilling_records
  add column if not exists shift text not null default 'DIA';

create index if not exists drilling_records_date_team_name_idx
  on drilling_records(date, team_name);

create index if not exists drilling_records_shift_idx
  on drilling_records(shift);

create index if not exists drilling_holes_record_id_idx
  on drilling_holes(record_id);

create index if not exists drilling_downtimes_record_id_idx
  on drilling_downtimes(record_id);

drop trigger if exists touch_drilling_records_updated_at on drilling_records;
create trigger touch_drilling_records_updated_at
before update on drilling_records
for each row execute function touch_updated_at();

drop trigger if exists touch_drilling_holes_updated_at on drilling_holes;
create trigger touch_drilling_holes_updated_at
before update on drilling_holes
for each row execute function touch_updated_at();

drop trigger if exists touch_drilling_downtimes_updated_at on drilling_downtimes;
create trigger touch_drilling_downtimes_updated_at
before update on drilling_downtimes
for each row execute function touch_updated_at();

insert into users (name, email, password_hash, role)
values
  ('Administrador', 'admin@dorighetto.local', crypt('admin123456', gen_salt('bf')), 'ADMIN'),
  ('Leitor', 'leitor@dorighetto.local', crypt('leitor123456', gen_salt('bf')), 'LEITOR')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  updated_at = now();
