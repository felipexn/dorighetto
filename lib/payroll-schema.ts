import type { PrismaClient } from "@prisma/client";

let schemaReady = false;

const statements = [
  `do $$
  begin
    create type "AdvanceStatus" as enum ('PENDENTE', 'DESCONTADO');
  exception when duplicate_object then null;
  end $$`,
  `alter table payroll_closures
    add column if not exists total_advance numeric(14, 2) not null default 0`,
  `create table if not exists payroll_advances (
    id text primary key,
    employee_name text not null,
    amount numeric(14, 2) not null,
    notes text not null,
    status "AdvanceStatus" not null default 'PENDENTE',
    closure_id text references payroll_closures(id) on delete set null,
    created_at timestamp(3) not null default now(),
    updated_at timestamp(3) not null default now()
  )`,
  `create index if not exists payroll_advances_employee_name_status_idx
    on payroll_advances(employee_name, status)`,
  `create index if not exists payroll_advances_closure_id_idx
    on payroll_advances(closure_id)`
];

export async function ensurePayrollSchema(prisma: PrismaClient) {
  if (schemaReady) return;

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  schemaReady = true;
}
