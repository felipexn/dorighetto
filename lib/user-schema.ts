import type { PrismaClient } from "@prisma/client";

let schemaReady = false;

const statements = [
  `alter type "UserRole" add value if not exists 'FINANCEIRO'`,
  `alter type "UserRole" add value if not exists 'RH'`,
  `alter type "UserRole" add value if not exists 'PERFURACAO'`,
  `alter table users add column if not exists is_active boolean not null default true`,
  `alter table users add column if not exists can_access_finance boolean not null default true`,
  `alter table users add column if not exists can_write_finance boolean not null default false`,
  `alter table users add column if not exists can_access_daily boolean not null default true`,
  `alter table users add column if not exists can_write_daily boolean not null default false`,
  `alter table users add column if not exists can_access_drilling boolean not null default true`,
  `alter table users add column if not exists can_write_drilling boolean not null default false`,
  `alter table users add column if not exists can_manage_users boolean not null default false`,
  `update users set can_manage_users = true where role = 'ADMIN'`
];

export async function ensureUserSchema(prisma: PrismaClient) {
  if (schemaReady) return;

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  schemaReady = true;
}
