import type { PrismaClient } from "@prisma/client";

let schemaReady = false;

const statements = [
  `do $$
  begin
    create type "EmployeeType" as enum ('DIARISTA', 'FICHADO');
  exception when duplicate_object then null;
  end $$`,
  `do $$
  begin
    create type "AdvanceStatus" as enum ('PENDENTE', 'DESCONTADO');
  exception when duplicate_object then null;
  end $$`,
  `do $$
  begin
    create type "AdditionStatus" as enum ('PENDENTE', 'INCLUIDO');
  exception when duplicate_object then null;
  end $$`,
  `create table if not exists payroll_employees (
    id text primary key,
    name text not null unique,
    role "DailyRole" not null,
    type "EmployeeType" not null default 'DIARISTA',
    daily_value numeric(14, 2),
    monthly_salary numeric(14, 2),
    default_overtime_rate numeric(14, 2),
    is_active boolean not null default true,
    created_at timestamp(3) not null default now(),
    updated_at timestamp(3) not null default now()
  )`,
  `create index if not exists payroll_employees_name_is_active_idx
    on payroll_employees(name, is_active)`,
  `alter table daily_entries
    add column if not exists employee_id text,
    add column if not exists employee_type "EmployeeType" not null default 'DIARISTA',
    add column if not exists monthly_salary numeric(14, 2)`,
  `alter table payroll_closures
    add column if not exists employee_type "EmployeeType" not null default 'DIARISTA',
    add column if not exists total_advance numeric(14, 2) not null default 0,
    add column if not exists total_addition numeric(14, 2) not null default 0`,
  `do $$
  begin
    alter table daily_entries
      add constraint daily_entries_employee_id_fkey
      foreign key (employee_id) references payroll_employees(id) on delete set null;
  exception when duplicate_object then null;
  end $$`,
  `create index if not exists daily_entries_employee_id_idx
    on daily_entries(employee_id)`,
  `insert into payroll_employees (id, name, role, type, daily_value, default_overtime_rate, is_active)
    select 'legacy_' || md5(employee_name), employee_name, min(role::text)::"DailyRole", 'DIARISTA', null, null, true
    from daily_entries
    where employee_name is not null
    group by employee_name
    on conflict (name) do nothing`,
  `update daily_entries de
    set employee_id = pe.id
    from payroll_employees pe
    where de.employee_id is null and de.employee_name = pe.name`,
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
    on payroll_advances(closure_id)`,
  `create table if not exists payroll_additions (
    id text primary key,
    employee_name text not null,
    amount numeric(14, 2) not null,
    notes text not null,
    status "AdditionStatus" not null default 'PENDENTE',
    closure_id text references payroll_closures(id) on delete set null,
    created_at timestamp(3) not null default now(),
    updated_at timestamp(3) not null default now()
  )`,
  `create index if not exists payroll_additions_employee_name_status_idx
    on payroll_additions(employee_name, status)`,
  `create index if not exists payroll_additions_closure_id_idx
    on payroll_additions(closure_id)`
];

export async function ensurePayrollSchema(prisma: PrismaClient) {
  if (schemaReady) return;

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  schemaReady = true;
}
