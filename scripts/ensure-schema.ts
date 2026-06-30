import { PrismaClient } from "@prisma/client";
import { ensureDrillingSchema } from "../lib/drilling-schema";
import { ensurePayrollSchema } from "../lib/payroll-schema";
import { ensureUserSchema } from "../lib/user-schema";

const prisma = new PrismaClient();

async function main() {
  await ensureUserSchema(prisma);
  await ensurePayrollSchema(prisma);
  await ensureDrillingSchema(prisma);
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
