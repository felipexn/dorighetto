import { PrismaClient } from "@prisma/client";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { decimalToNumber, formatDate } from "@/lib/format";
import { normalizeDrillingBankName, normalizeDrillingMachineName, normalizeDrillingShift, formatDrillingShift } from "@/lib/drilling";

export type ChartItem = { label: string; value: number };
export type DrillingReportRecord = {
  date: string;
  teamName: string;
  machineName: string;
  bankName: string;
  activityCode: string;
  shift: string;
  holes: { meters: number }[];
  downtimes: { reason: string; hours: number }[];
};

export type DrillingReportFilters = {
  equipe?: string;
  banco?: string;
  perfuratriz?: string;
  atividade?: string;
  turno?: string;
  parada?: string;
  inicio?: string;
  fim?: string;
};

export type DrillingReportSummary = ReturnType<typeof summarizeRecords>;

export type DrillingReportData = {
  filters: DrillingReportFilters;
  hasReportPeriod: boolean;
  reportPeriod: string;
  recordsCount: number;
  reportRecordsCount: number;
  filteredSummary: DrillingReportSummary;
  reportSummary: DrillingReportSummary;
  options: {
    equipes: string[];
    bancos: string[];
    perfuratrizes: string[];
    atividades: string[];
    paradas: string[];
  };
  setupWarning: string;
};

export function metersLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

export function shortNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function recordMeters(record: DrillingReportRecord) {
  return record.holes.reduce((acc, hole) => acc + hole.meters, 0);
}

export function hoursLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

export function recordDowntimeHours(record: DrillingReportRecord) {
  return record.downtimes.reduce((acc, downtime) => acc + downtime.hours, 0);
}

function groupMetersByRecords(
  records: DrillingReportRecord[],
  key: "teamName" | "bankName" | "machineName" | "activityCode"
) {
  const map = new Map<string, number>();
  for (const record of records) {
    const label = key === "bankName"
      ? normalizeDrillingBankName(record.bankName)
      : key === "machineName"
        ? normalizeDrillingMachineName(record.machineName)
        : record[key];
    map.set(label, (map.get(label) ?? 0) + recordMeters(record));
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function bankSortValue(value: string) {
  return /^\d+$/.test(value) ? Number(value) : Number.POSITIVE_INFINITY;
}

export function uniqueBankOptions(items: { bankName: string }[]) {
  return Array.from(new Set(items.map((item) => normalizeDrillingBankName(item.bankName))))
    .sort((a, b) => {
      const numericA = bankSortValue(a);
      const numericB = bankSortValue(b);
      if (numericA !== numericB) return numericA - numericB;
      return a.localeCompare(b, "pt-BR", { numeric: true });
    });
}

export function uniqueMachineOptions(items: { machineName: string }[]) {
  return Array.from(new Set(items.map((item) => normalizeDrillingMachineName(item.machineName))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function groupMetersByDate(records: DrillingReportRecord[]) {
  return Array.from(records.reduce((map, record) => {
    const key = record.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + recordMeters(record));
    return map;
  }, new Map<string, number>()).entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([label, value]) => ({ label: formatDate(new Date(`${label}T00:00:00.000Z`)), value }));
}

function groupDowntimeByReason(records: DrillingReportRecord[]) {
  const map = new Map<string, number>();
  for (const record of records) {
    for (const downtime of record.downtimes) {
      map.set(downtime.reason, (map.get(downtime.reason) ?? 0) + downtime.hours);
    }
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function groupDowntimeByRecords(records: DrillingReportRecord[], key: "teamName" | "bankName" | "machineName") {
  const map = new Map<string, number>();
  for (const record of records) {
    const label = key === "bankName"
      ? normalizeDrillingBankName(record.bankName)
      : key === "machineName"
        ? normalizeDrillingMachineName(record.machineName)
        : record[key];
    map.set(label, (map.get(label) ?? 0) + recordDowntimeHours(record));
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function summarizeRecords(records: DrillingReportRecord[]) {
  const totalMetros = records.reduce((acc, record) => acc + recordMeters(record), 0);
  const totalFuros = records.reduce((acc, record) => acc + record.holes.length, 0);
  const totalHorasParadas = records.reduce((acc, record) => acc + recordDowntimeHours(record), 0);
  const uniqueDateCount = new Set(records.map((record) => record.date.slice(0, 10))).size;
  const mediaDia = uniqueDateCount > 0 ? totalMetros / uniqueDateCount : 0;
  const mediaFicha = records.length > 0 ? totalMetros / records.length : 0;
  const mediaFuro = totalFuros > 0 ? totalMetros / totalFuros : 0;
  const mediaHorasParadasFicha = records.length > 0 ? totalHorasParadas / records.length : 0;
  const byTeam = groupMetersByRecords(records, "teamName");
  const byBank = groupMetersByRecords(records, "bankName");
  const byMachine = groupMetersByRecords(records, "machineName");
  const byActivity = groupMetersByRecords(records, "activityCode");
  const byDowntimeReason = groupDowntimeByReason(records);
  const downtimeByTeam = groupDowntimeByRecords(records, "teamName");
  const downtimeByBank = groupDowntimeByRecords(records, "bankName");
  const downtimeByMachine = groupDowntimeByRecords(records, "machineName");
  const byDate = groupMetersByDate(records);
  const bestDay = byDate.reduce<ChartItem | undefined>((best, item) => !best || item.value > best.value ? item : best, undefined);

  return {
    totalMetros,
    totalFuros,
    totalHorasParadas,
    uniqueDateCount,
    mediaDia,
    mediaFicha,
    mediaFuro,
    mediaHorasParadasFicha,
    byTeam,
    byBank,
    byMachine,
    byActivity,
    byDowntimeReason,
    downtimeByTeam,
    downtimeByBank,
    downtimeByMachine,
    byDate,
    bestDay,
    topTeam: byTeam[0],
    topBank: byBank[0],
    topMachine: byMachine[0],
    topDowntimeReason: byDowntimeReason[0]
  };
}


function sanitizeFilters(filters: DrillingReportFilters): DrillingReportFilters {
  return {
    equipe: filters.equipe?.trim() || undefined,
    banco: filters.banco?.trim() || undefined,
    perfuratriz: filters.perfuratriz?.trim() || undefined,
    atividade: filters.atividade?.trim() || undefined,
    turno: filters.turno?.trim() ? normalizeDrillingShift(filters.turno) : undefined,
    parada: filters.parada?.trim() || undefined,
    inicio: filters.inicio?.trim() || undefined,
    fim: filters.fim?.trim() || undefined
  };
}

export async function getDrillingReportData(prisma: PrismaClient, rawFilters: DrillingReportFilters): Promise<DrillingReportData> {
  const filters = sanitizeFilters(rawFilters);
  const startDate = filters.inicio ? new Date(`${filters.inicio}T00:00:00.000Z`) : undefined;
  const endDate = filters.fim ? new Date(`${filters.fim}T23:59:59.999Z`) : undefined;
  const selectedShift = filters.turno || "";
  const selectedDowntimeReason = filters.parada || "";
  const hasReportPeriod = Boolean(filters.inicio || filters.fim);
  let setupWarning = "";

  try {
    await ensureDrillingSchema(prisma);

    let records = await prisma.drillingRecord.findMany({
      where: {
        teamName: filters.equipe || undefined,
        activityCode: filters.atividade || undefined,
        shift: selectedShift || undefined,
        downtimes: selectedDowntimeReason ? { some: { reason: selectedDowntimeReason } } : undefined,
        date: startDate || endDate ? { gte: startDate, lte: endDate } : undefined
      },
      include: {
        holes: { orderBy: { createdAt: "asc" } },
        downtimes: { orderBy: { createdAt: "asc" } }
      },
      orderBy: [{ date: "desc" }, { teamName: "asc" }]
    });

    const reportRecords = await prisma.drillingRecord.findMany({
      where: {
        shift: selectedShift || undefined,
        downtimes: selectedDowntimeReason ? { some: { reason: selectedDowntimeReason } } : undefined,
        date: startDate || endDate ? { gte: startDate, lte: endDate } : undefined
      },
      include: {
        holes: { orderBy: { createdAt: "asc" } },
        downtimes: { orderBy: { createdAt: "asc" } }
      },
      orderBy: [{ date: "asc" }, { teamName: "asc" }]
    });

    const [equipes, bancos, perfuratrizes, atividades, paradas] = await Promise.all([
      prisma.drillingRecord.findMany({ distinct: ["teamName"], select: { teamName: true }, orderBy: { teamName: "asc" } }),
      prisma.drillingRecord.findMany({ distinct: ["bankName"], select: { bankName: true }, orderBy: { bankName: "asc" } }),
      prisma.drillingRecord.findMany({ distinct: ["machineName"], select: { machineName: true }, orderBy: { machineName: "asc" } }),
      prisma.drillingRecord.findMany({ distinct: ["activityCode"], select: { activityCode: true }, orderBy: { activityCode: "asc" } }),
      prisma.drillingDowntime.findMany({ distinct: ["reason"], select: { reason: true }, orderBy: { reason: "asc" } })
    ]);

    const selectedBank = filters.banco ? normalizeDrillingBankName(filters.banco) : "";
    const selectedMachine = filters.perfuratriz ? normalizeDrillingMachineName(filters.perfuratriz) : "";
    if (selectedBank) {
      records = records.filter((record) => normalizeDrillingBankName(record.bankName) === selectedBank);
    }
    if (selectedMachine) {
      records = records.filter((record) => normalizeDrillingMachineName(record.machineName) === selectedMachine);
    }

    const serialize = (items: typeof records): DrillingReportRecord[] => items.map((record) => ({
      date: record.date.toISOString(),
      teamName: record.teamName,
      machineName: normalizeDrillingMachineName(record.machineName),
      bankName: normalizeDrillingBankName(record.bankName),
      activityCode: record.activityCode,
      shift: record.shift,
      holes: record.holes.map((hole) => ({ meters: decimalToNumber(hole.meters) })),
      downtimes: record.downtimes.map((downtime) => ({
        reason: downtime.reason,
        hours: decimalToNumber(downtime.hours)
      }))
    }));

    const filteredRecords = serialize(records);
    const consolidatedRecords = serialize(reportRecords);
    const reportPeriod = hasReportPeriod
      ? `${filters.inicio ? formatDate(new Date(`${filters.inicio}T00:00:00.000Z`)) : "Início"} até ${filters.fim ? formatDate(new Date(`${filters.fim}T00:00:00.000Z`)) : "Hoje"}${selectedShift ? ` | Turno: ${formatDrillingShift(selectedShift)}` : ""}`
      : "";

    return {
      filters,
      hasReportPeriod,
      reportPeriod,
      recordsCount: filteredRecords.length,
      reportRecordsCount: consolidatedRecords.length,
      filteredSummary: summarizeRecords(filteredRecords),
      reportSummary: summarizeRecords(consolidatedRecords),
      options: {
        equipes: equipes.map((item) => item.teamName),
        bancos: uniqueBankOptions(bancos),
        perfuratrizes: uniqueMachineOptions(perfuratrizes),
        atividades: atividades.map((item) => item.activityCode),
        paradas: paradas.map((item) => item.reason)
      },
      setupWarning
    };
  } catch {
    setupWarning = "Módulo criado. Falta apenas sincronizar o schema no banco para listar os relatórios.";
  }

  const emptySummary = summarizeRecords([]);
  return {
    filters,
    hasReportPeriod,
    reportPeriod: "",
    recordsCount: 0,
    reportRecordsCount: 0,
    filteredSummary: emptySummary,
    reportSummary: emptySummary,
    options: { equipes: [], bancos: [], perfuratrizes: [], atividades: [], paradas: [] },
    setupWarning
  };
}
