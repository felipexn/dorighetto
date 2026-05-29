import { PrismaClient, Prisma } from "@prisma/client";
import { ensureDrillingSchema } from "../lib/drilling-schema";

const prisma = new PrismaClient();
const marker = "DADOS TESTE GRAFICOS ROBSON";

const holes = [
  ["F25", "5.60"],
  ["F42", "5.20"],
  ["F53", "4.80"],
  ["F44", "4.70"],
  ["F43", "4.70"],
  ["F32", "4.70"],
  ["F35", "4.60"],
  ["F27", "4.60"],
  ["F29", "4.60"],
  ["F26", "4.90"],
  ["F20", "4.20"],
  ["F10", "5.40"],
  ["F37", "5.20"],
  ["F21", "5.90"]
];

async function createRecord(sequence: number) {
  await prisma.drillingRecord.create({
    data: {
      date: new Date("2026-05-14T00:00:00.000Z"),
      teamName: "ROBSON",
      machineName: "NAO INFORMADA",
      bankName: "03",
      activityCode: "35",
      motorStart: "NAO INFORMADO",
      motorEnd: "NAO INFORMADO",
      notes: `${marker} - ficha ${sequence} - ENTRADA 8:30 / ALMOCO / SAIDA 18:06`,
      holes: {
        create: holes.map(([holeCode, meters]) => ({
          holeCode,
          meters: new Prisma.Decimal(meters)
        }))
      }
    }
  });
}

async function main() {
  await ensureDrillingSchema(prisma);

  await prisma.drillingRecord.deleteMany({
    where: {
      notes: {
        contains: marker
      }
    }
  });

  await createRecord(1);
  await createRecord(2);
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
