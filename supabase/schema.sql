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

insert into users (name, email, password_hash, role)
values
  ('Administrador', 'admin@dorighetto.local', crypt('admin123456', gen_salt('bf')), 'ADMIN'),
  ('Leitor', 'leitor@dorighetto.local', crypt('leitor123456', gen_salt('bf')), 'LEITOR')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  updated_at = now();
