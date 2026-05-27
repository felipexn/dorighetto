import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(email: string, password: string, name: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role }
  });
}

async function main() {
  await upsertUser(
    process.env.ADMIN_EMAIL ?? "admin@dorighetto.local",
    process.env.ADMIN_PASSWORD ?? "admin123456",
    "Administrador",
    "ADMIN"
  );

  await upsertUser(
    process.env.READER_EMAIL ?? "leitor@dorighetto.local",
    process.env.READER_PASSWORD ?? "leitor123456",
    "Leitor",
    "LEITOR"
  );
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
