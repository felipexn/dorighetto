# Dorighetto Financeiro

Módulo interno em Next.js para financeiro, pagamentos, perfuração e administração de usuários.

## Comandos

```bash
npm install
npm run db:generate
npm run db:push
npm run db:ensure-schema
npm run db:seed
npm run dev
```

## Seed seguro

Antes de rodar `npm run db:seed`, defina pelo menos `ADMIN_PASSWORD` com 12 ou mais caracteres. O usuário leitor inicial é opcional.

Exemplo no PowerShell:

```powershell
$env:ADMIN_PASSWORD="troque-por-uma-senha-forte"
$env:READER_PASSWORD="outra-senha-forte"
npm run db:seed
```

## Perfis

- `ADMIN`: administra usuários e acessos.
- `FINANCEIRO`: acessa e edita o financeiro.
- `RH`: acessa e edita pagamentos/diárias.
- `PERFURACAO`: acessa e edita perfuração.
- `LEITOR`: visualiza módulos liberados sem editar.

## Supabase

Use o PostgreSQL do Supabase como banco. A aplicação usa `DATABASE_URL` via Prisma.