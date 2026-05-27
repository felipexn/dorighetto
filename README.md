# Dorighetto Financeiro

Modulo financeiro em Next.js para planilhas independentes de entrada e saida.

## Comandos

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Perfis

- `ADMIN`: cria/deleta planilhas e adiciona/remova lancamentos.
- `LEITOR`: visualiza planilhas e lancamentos.

## Supabase

Use o PostgreSQL do Supabase como banco. A aplicacao usa `DATABASE_URL` via Prisma.
