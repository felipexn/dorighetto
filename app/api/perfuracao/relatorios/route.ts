import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getDrillingReportData, type DrillingReportFilters } from "@/lib/drilling-report-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireModule("perfuracao");

  const { searchParams } = new URL(request.url);
  const filters: DrillingReportFilters = {
    equipe: searchParams.get("equipe") || undefined,
    banco: searchParams.get("banco") || undefined,
    perfuratriz: searchParams.get("perfuratriz") || undefined,
    atividade: searchParams.get("atividade") || undefined,
    turno: searchParams.get("turno") || undefined,
    inicio: searchParams.get("inicio") || undefined,
    fim: searchParams.get("fim") || undefined
  };

  const data = await getDrillingReportData(prisma, filters);
  return NextResponse.json(data);
}
