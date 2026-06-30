import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const minimumPasswordLength = 12;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Configure ${name} antes de rodar npm run db:seed.`);
  }
  return value;
}

function assertSeedPassword(name: string, password: string) {
  if (password.length < minimumPasswordLength) {
    throw new Error(`${name} deve ter pelo menos ${minimumPasswordLength} caracteres.`);
  }
}

async function upsertUser(email: string, password: string, name: string, role: UserRole) {
  assertSeedPassword(`${role}_PASSWORD`, password);
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role }
  });
}

async function main() {
  await upsertUser(
    process.env.ADMIN_EMAIL?.trim() || "admin@dorighetto.local",
    requiredEnv("ADMIN_PASSWORD"),
    "Administrador",
    "ADMIN"
  );

  const readerPassword = process.env.READER_PASSWORD?.trim();
  if (readerPassword) {
    await upsertUser(
      process.env.READER_EMAIL?.trim() || "leitor@dorighetto.local",
      readerPassword,
      "Leitor",
      "LEITOR"
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });