import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DailyImport = {
  date: string;
  employeeName: string;
  role: "AJUDANTE" | "OPERADOR";
  dailyValue: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimeTotal: number;
  dayTotal: number;
  notes: string;
};

async function main() {
  const file = path.join(process.cwd(), "scripts", "diarias-import.json");
  const raw = await fs.readFile(file, "utf-8");
  const entries = JSON.parse(raw.replace(/^\uFEFF/, "")) as DailyImport[];
  const employeeNames = [...new Set(entries.map((entry) => entry.employeeName))];

  await prisma.dailyEntry.deleteMany({
    where: {
      employeeName: { in: employeeNames },
      status: "PENDENTE"
    }
  });

  await prisma.dailyEntry.createMany({
    data: entries.map((entry) => ({
      date: new Date(`${entry.date}T00:00:00.000Z`),
      employeeName: entry.employeeName,
      role: entry.role,
      dailyValue: entry.dailyValue,
      overtimeHours: entry.overtimeHours,
      overtimeRate: entry.overtimeRate,
      overtimeTotal: entry.overtimeTotal,
      dayTotal: entry.dayTotal,
      notes: entry.notes || null
    }))
  });

  const count = await prisma.dailyEntry.count({
    where: {
      employeeName: { in: employeeNames },
      status: "PENDENTE"
    }
  });

  console.log(`Importacao de diarias concluida. Pendentes importadas: ${count}`);
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
