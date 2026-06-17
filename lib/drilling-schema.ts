import type { PrismaClient } from "@prisma/client";

let schemaReady = false;

const statements = [
  `create table if not exists drilling_records (
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
  )`,
  `create table if not exists drilling_holes (
    id text primary key,
    record_id text not null references drilling_records(id) on delete cascade,
    hole_code text not null,
    meters numeric(10, 2) not null,
    created_at timestamp(3) not null default now(),
    updated_at timestamp(3) not null default now()
  )`,
  `create table if not exists drilling_downtimes (
    id text primary key,
    record_id text not null references drilling_records(id) on delete cascade,
    reason text not null,
    hours numeric(8, 2) not null,
    created_at timestamp(3) not null default now(),
    updated_at timestamp(3) not null default now()
  )`,
  `alter table drilling_records
    add column if not exists shift text not null default 'DIA'`,
  `create index if not exists drilling_records_date_team_name_idx
    on drilling_records(date, team_name)`,
  `create index if not exists drilling_records_shift_idx
    on drilling_records(shift)`,
  `create index if not exists drilling_holes_record_id_idx
    on drilling_holes(record_id)`,
  `create index if not exists drilling_downtimes_record_id_idx
    on drilling_downtimes(record_id)`
];

export async function ensureDrillingSchema(prisma: PrismaClient) {
  if (schemaReady) return;

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  schemaReady = true;
}
