import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ImportSheet = {
  name: string;
  purpose: string;
  description: string;
  entries: Array<{
    date: string | null;
    item: string;
    quantity: string;
    type: "ENTRADA" | "SAIDA";
    value: number;
  }>;
};

async function main() {
  const file = path.join(process.cwd(), "scripts", "financeiro-import.json");
  const raw = await fs.readFile(file, "utf-8");
  const sheets = JSON.parse(raw.replace(/^\uFEFF/, "")) as ImportSheet[];

  for (const sheet of sheets) {
    const fallbackDate = sheet.entries.find((entry) => entry.date)?.date;

    await prisma.financialSheet.deleteMany({
      where: { name: sheet.name }
    });

    await prisma.financialSheet.create({
      data: {
        name: sheet.name,
        purpose: sheet.purpose,
        description: sheet.description,
        entries: {
          create: sheet.entries
            .filter((entry) => entry.item && Number.isFinite(entry.value) && (entry.date || fallbackDate))
            .map((entry) => ({
              date: new Date(`${entry.date ?? fallbackDate}T00:00:00.000Z`),
              item: entry.item,
              quantity: entry.quantity || null,
              type: entry.type,
              value: entry.value
            }))
        }
      }
    });
  }

  const count = await prisma.financialEntry.count();
  console.log(`Importacao concluida. Lancamentos no banco: ${count}`);
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
