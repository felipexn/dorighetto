import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, Award, BarChart3, CalendarDays, Gauge, Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrintReportButton } from "@/components/print-report-button";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { decimalToNumber, formatDate } from "@/lib/format";
import { drillingShiftOptions, formatDrillingShift, normalizeDrillingBankName, normalizeDrillingMachineName, normalizeDrillingShift } from "@/lib/drilling";

type SearchParams = Promise<{
  equipe?: string;
  banco?: string;
  perfuratriz?: string;
  atividade?: string;
  turno?: string;
  inicio?: string;
  fim?: string;
}>;

type ChartItem = { label: string; value: number };
type DrillReportRecord = {
  date: Date;
  teamName: string;
  machineName: string;
  bankName: string;
  activityCode: string;
  shift: string;
  holes: { meters: number | { toNumber: () => number } }[];
};
type ChartStyle = CSSProperties & {
  "--bar-width"?: string;
  "--line-point-x"?: string;
  "--line-point-y"?: string;
  "--donut"?: string;
};

function metersLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

function shortNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function recordMeters(record: DrillReportRecord) {
  return record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
}

function groupMetersByRecords(
  records: DrillReportRecord[],
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

function uniqueBankOptions(items: { bankName: string }[]) {
  return Array.from(new Set(items.map((item) => normalizeDrillingBankName(item.bankName))))
    .sort((a, b) => {
      const numericA = bankSortValue(a);
      const numericB = bankSortValue(b);
      if (numericA !== numericB) return numericA - numericB;
      return a.localeCompare(b, "pt-BR", { numeric: true });
    });
}

function uniqueMachineOptions(items: { machineName: string }[]) {
  return Array.from(new Set(items.map((item) => normalizeDrillingMachineName(item.machineName))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function groupMetersByDate(records: DrillReportRecord[]) {
  return Array.from(records.reduce((map, record) => {
    const key = record.date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + recordMeters(record));
    return map;
  }, new Map<string, number>()).entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([label, value]) => ({ label: formatDate(new Date(`${label}T00:00:00.000Z`)), value }));
}

function summarizeRecords(records: DrillReportRecord[]) {
  const totalMetros = records.reduce((acc, record) => acc + recordMeters(record), 0);
  const totalFuros = records.reduce((acc, record) => acc + record.holes.length, 0);
  const uniqueDates = new Set(records.map((record) => record.date.toISOString().slice(0, 10)));
  const mediaDia = uniqueDates.size > 0 ? totalMetros / uniqueDates.size : 0;
  const mediaFicha = records.length > 0 ? totalMetros / records.length : 0;
  const mediaFuro = totalFuros > 0 ? totalMetros / totalFuros : 0;
  const byTeam = groupMetersByRecords(records, "teamName");
  const byBank = groupMetersByRecords(records, "bankName");
  const byMachine = groupMetersByRecords(records, "machineName");
  const byActivity = groupMetersByRecords(records, "activityCode");
  const byDate = groupMetersByDate(records);
  const bestDay = byDate.reduce<ChartItem | undefined>((best, item) => !best || item.value > best.value ? item : best, undefined);

  return {
    totalMetros,
    totalFuros,
    uniqueDates,
    mediaDia,
    mediaFicha,
    mediaFuro,
    byTeam,
    byBank,
    byMachine,
    byActivity,
    byDate,
    bestDay,
    topTeam: byTeam[0],
    topBank: byBank[0],
    topMachine: byMachine[0]
  };
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="analytics-metric-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function EvolutionLineChart({ items }: { items: ChartItem[] }) {
  const width = 900;
  const height = 360;
  const padX = 58;
  const padTop = 36;
  const plotBottom = height - 100;
  const labelY = height - 12;
  const max = Math.max(...items.map((item) => item.value), 1);
  const steps = [1, 0.75, 0.5, 0.25, 0];
  const points = items.map((item, index) => {
    const x = items.length === 1 ? padX : padX + (index / (items.length - 1)) * (width - padX * 2);
    const y = padTop + (1 - item.value / max) * (plotBottom - padTop);
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const areaPath = points.length > 0
    ? `${path} L ${points[points.length - 1].x.toFixed(1)} ${plotBottom} L ${points[0].x.toFixed(1)} ${plotBottom} Z`
    : "";

  return (
    <section className="panel analytics-card line-analysis-card">
      <div className="analytics-card-head">
        <div><span>Análise</span><h2>Evolução de metros perfurados</h2></div>
        <strong>{items.length} datas</strong>
      </div>
      {items.length === 0 ? <p className="muted-text">Sem dados no filtro atual.</p> : null}
      {items.length > 0 ? (
        <div className="line-chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução de metros perfurados">
            {steps.map((step) => {
              const y = padTop + (1 - step) * (plotBottom - padTop);
              return (
                <g key={step}>
                  <line x1={padX} x2={width - padX} y1={y} y2={y} />
                  <text x={padX - 16} y={y + 5}>{shortNumber(max * step)} m</text>
                </g>
              );
            })}
            <path className="line-area" d={areaPath} />
            <path className="line-stroke" d={path} />
            {points.map((point) => (
              <circle key={point.label} cx={point.x} cy={point.y} r="7" />
            ))}
            {points.map((point, index) => (
              <text
                className="line-date"
                key={`${point.label}-${index}`}
                x={point.x}
                y={labelY}
                textAnchor="start"
                transform={`rotate(-90 ${point.x} ${labelY})`}
              >
                {point.label}
              </text>
            ))}
          </svg>
        </div>
      ) : null}
    </section>
  );
}

function OperationalSummary({ summary, recordCount }: { summary: ReturnType<typeof summarizeRecords>; recordCount: number }) {
  return (
    <section className="panel analytics-card operational-summary-card">
      <div className="analytics-card-head compact-head">
        <div><span>Destaques</span><h2>Resumo operacional</h2></div>
      </div>
      <div className="summary-highlight-list">
        <div><span>Banco mais produtivo</span><strong>{summary.topBank?.label ?? "-"}</strong><small>{summary.topBank ? metersLabel(summary.topBank.value) : "Sem dados"}</small></div>
        <div><span>Perfuratriz líder</span><strong>{summary.topMachine?.label ?? "-"}</strong><small>{summary.topMachine ? metersLabel(summary.topMachine.value) : "Sem dados"}</small></div>
        <div><span>Fichas e furos</span><strong>{recordCount} fichas</strong><small>{summary.totalFuros} furos registrados</small></div>
      </div>
    </section>
  );
}

function TeamProduction({ items }: { items: ChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="panel analytics-card team-production-card">
      <div className="analytics-card-head">
        <div><span>Análise</span><h2>Produção por equipe</h2></div>
        <strong>Top {Math.min(items.length, 4)}</strong>
      </div>
      <div className="team-block-grid">
        {items.length === 0 ? <p className="muted-text">Sem dados no filtro atual.</p> : null}
        {items.slice(0, 4).map((item, index) => (
          <div className="team-production-block" key={item.label}>
            <span>{index + 1}</span>
            <strong>{item.label || "Não informado"}</strong>
            <small>{metersLabel(item.value)}</small>
            <div style={{ "--bar-width": `${Math.max((item.value / max) * 100, 8)}%` } as ChartStyle} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BankParticipation({ items, total }: { items: ChartItem[]; total: number }) {
  const first = items[0];
  const firstPercent = first && total > 0 ? (first.value / total) * 100 : 0;

  return (
    <section className="panel analytics-card bank-participation-card">
      <div className="analytics-card-head">
        <div><span>Análise</span><h2>Participação por banco</h2></div>
        <strong>{items.length} grupos</strong>
      </div>
      <div className="donut-layout">
        <div className="donut-chart" style={{ "--donut": `${firstPercent * 3.6}deg` } as ChartStyle}>
          <strong>{shortNumber(total)} m</strong>
          <span>no período</span>
        </div>
        <div className="donut-legend">
          {items.slice(0, 5).map((item, index) => {
            const itemPercent = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.label}>
                <span className={index === 0 ? "legend-dot green" : "legend-dot gold"} />
                <strong>{item.label || "Não informado"}</strong>
                <small>{itemPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReportRanking({ title, items }: { title: string; items: ChartItem[] }) {
  return (
    <div className="report-ranking-card">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="muted-text">Sem dados no período.</p> : null}
      {items.slice(0, 6).map((item, index) => (
        <div className="report-ranking-row" key={`${title}-${item.label}`}>
          <span>{index + 1}</span>
          <strong>{item.label || "Não informado"}</strong>
          <small>{metersLabel(item.value)}</small>
        </div>
      ))}
    </div>
  );
}

export default async function RelatoriosPerfuracaoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const startDate = params.inicio ? new Date(`${params.inicio}T00:00:00.000Z`) : undefined;
  const endDate = params.fim ? new Date(`${params.fim}T23:59:59.999Z`) : undefined;
  const selectedShift = params.turno ? normalizeDrillingShift(params.turno) : "";
  const hasReportPeriod = Boolean(params.inicio || params.fim);

  let records: DrillReportRecord[] = [];
  let reportRecords: DrillReportRecord[] = [];
  let equipes: { teamName: string }[] = [];
  let bancos: { bankName: string }[] = [];
  let perfuratrizes: { machineName: string }[] = [];
  let atividades: { activityCode: string }[] = [];
  let setupWarning = "";

  try {
    await ensureDrillingSchema(prisma);

    records = await prisma.drillingRecord.findMany({
      where: {
        teamName: params.equipe || undefined,
        activityCode: params.atividade || undefined,
        shift: selectedShift || undefined,
        date: startDate || endDate ? { gte: startDate, lte: endDate } : undefined
      },
      include: { holes: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ date: "desc" }, { teamName: "asc" }]
    });

    reportRecords = await prisma.drillingRecord.findMany({
      where: {
        shift: selectedShift || undefined,
        date: startDate || endDate ? { gte: startDate, lte: endDate } : undefined
      },
      include: { holes: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ date: "asc" }, { teamName: "asc" }]
    });

    equipes = await prisma.drillingRecord.findMany({ distinct: ["teamName"], select: { teamName: true }, orderBy: { teamName: "asc" } });
    bancos = await prisma.drillingRecord.findMany({ distinct: ["bankName"], select: { bankName: true }, orderBy: { bankName: "asc" } });
    perfuratrizes = await prisma.drillingRecord.findMany({ distinct: ["machineName"], select: { machineName: true }, orderBy: { machineName: "asc" } });
    atividades = await prisma.drillingRecord.findMany({ distinct: ["activityCode"], select: { activityCode: true }, orderBy: { activityCode: "asc" } });
  } catch {
    setupWarning = "Módulo criado. Falta apenas sincronizar o schema no banco para listar os relatórios.";
  }

  const selectedBank = params.banco ? normalizeDrillingBankName(params.banco) : "";
  const selectedMachine = params.perfuratriz ? normalizeDrillingMachineName(params.perfuratriz) : "";
  if (selectedBank) {
    records = records.filter((record) => normalizeDrillingBankName(record.bankName) === selectedBank);
  }
  if (selectedMachine) {
    records = records.filter((record) => normalizeDrillingMachineName(record.machineName) === selectedMachine);
  }

  const bancoOptions = uniqueBankOptions(bancos);
  const machineOptions = uniqueMachineOptions(perfuratrizes);
  const filteredSummary = summarizeRecords(records);
  const reportSummary = summarizeRecords(reportRecords);
  const reportPeriod = hasReportPeriod
    ? `${params.inicio ? formatDate(new Date(`${params.inicio}T00:00:00.000Z`)) : "Início"} até ${params.fim ? formatDate(new Date(`${params.fim}T00:00:00.000Z`)) : "Hoje"}${selectedShift ? ` | Turno: ${formatDrillingShift(selectedShift)}` : ""}`
    : "";

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios de perfuração"
        description="Gere prestação de contas por período e acompanhe a produtividade das equipes."
        actions={<Link className="button secondary" href="/perfuracao"><ArrowLeft size={18} /> Voltar para fichas</Link>}
      />
      {setupWarning ? <section className="form-error">{setupWarning}</section> : null}

      <section className="panel report-generator section-gap no-print">
        <div>
          <span className="eyebrow">Prestação de contas</span>
          <h2>Gerar relatório por período</h2>
          <p>Escolha o intervalo desejado. O relatório consolidado só aparece depois que uma data for selecionada.</p>
        </div>
        <form className="report-period-form">
          <label>De<input name="inicio" type="date" defaultValue={params.inicio ?? ""} /></label>
          <label>Até<input name="fim" type="date" defaultValue={params.fim ?? ""} /></label>
          <label>Turno
            <select name="turno" defaultValue={selectedShift}>
              <option value="">Todos</option>
              {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
            </select>
          </label>
          <button type="submit">Gerar relatório</button>
        </form>
      </section>

      {hasReportPeriod ? (
        <section className="panel consolidated-report print-report-section section-gap">
          <div className="report-title-row">
            <div>
              <span className="eyebrow">Relatório consolidado</span>
              <h2>Prestação de contas da perfuração</h2>
              <p>Período: <strong>{reportPeriod}</strong></p>
            </div>
            <PrintReportButton />
          </div>

          <div className="report-summary-grid">
            <div><span>Metros perfurados</span><strong>{metersLabel(reportSummary.totalMetros)}</strong></div>
            <div><span>Média por dia</span><strong>{metersLabel(reportSummary.mediaDia)}</strong></div>
            <div><span>Média por ficha</span><strong>{metersLabel(reportSummary.mediaFicha)}</strong></div>
            <div><span>Média por furo</span><strong>{metersLabel(reportSummary.mediaFuro)}</strong></div>
            <div><span>Equipe melhor</span><strong>{reportSummary.topTeam?.label ?? "-"}</strong><small>{reportSummary.topTeam ? metersLabel(reportSummary.topTeam.value) : "Sem dados"}</small></div>
            <div><span>Banco mais furado</span><strong>{reportSummary.topBank?.label ?? "-"}</strong><small>{reportSummary.topBank ? metersLabel(reportSummary.topBank.value) : "Sem dados"}</small></div>
            <div><span>Fichas lançadas</span><strong>{reportRecords.length}</strong></div>
            <div><span>Total de furos</span><strong>{reportSummary.totalFuros}</strong></div>
          </div>

          <div className="report-details-grid">
            <ReportRanking title="Equipes no período" items={reportSummary.byTeam} />
            <ReportRanking title="Bancos no período" items={reportSummary.byBank} />
            <ReportRanking title="Perfuratrizes no período" items={reportSummary.byMachine} />
            <ReportRanking title="Atividades no período" items={reportSummary.byActivity} />
          </div>
        </section>
      ) : null}

      <form className="panel filters section-gap no-print">
        <label>Equipe
          <select name="equipe" defaultValue={params.equipe ?? ""}>
            <option value="">Todas</option>
            {equipes.map((item) => <option key={item.teamName}>{item.teamName}</option>)}
          </select>
        </label>
        <label>Banco
          <select name="banco" defaultValue={selectedBank}>
            <option value="">Todos</option>
            {bancoOptions.map((bankName) => <option key={bankName}>{bankName}</option>)}
          </select>
        </label>
        <label>Perfuratriz
          <select name="perfuratriz" defaultValue={selectedMachine}>
            <option value="">Todas</option>
            {machineOptions.map((machineName) => <option key={machineName}>{machineName}</option>)}
          </select>
        </label>
        <label>Atividade
          <select name="atividade" defaultValue={params.atividade ?? ""}>
            <option value="">Todas</option>
            {atividades.map((item) => <option key={item.activityCode}>{item.activityCode}</option>)}
          </select>
        </label>
        <label>Turno
          <select name="turno" defaultValue={selectedShift}>
            <option value="">Todos</option>
            {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
          </select>
        </label>
        <label>De<input name="inicio" type="date" defaultValue={params.inicio ?? ""} /></label>
        <label>Até<input name="fim" type="date" defaultValue={params.fim ?? ""} /></label>
        <button type="submit">Filtrar gráficos</button>
      </form>

      <section className="analytics-metric-grid section-gap no-print">
        <MetricCard icon={<Target size={18} />} label="Total perfurado" value={metersLabel(filteredSummary.totalMetros)} />
        <MetricCard icon={<TrendingUp size={18} />} label="Média por dia" value={metersLabel(filteredSummary.mediaDia)} />
        <MetricCard icon={<Gauge size={18} />} label="Média por ficha" value={metersLabel(filteredSummary.mediaFicha)} />
        <MetricCard icon={<BarChart3 size={18} />} label="Média por furo" value={metersLabel(filteredSummary.mediaFuro)} />
        <MetricCard icon={<Award size={18} />} label="Equipe líder" value={filteredSummary.topTeam?.label ?? "-"} />
        <MetricCard icon={<CalendarDays size={18} />} label="Melhor dia" value={filteredSummary.bestDay?.label ?? "-"} />
      </section>

      <section className="analytics-dashboard-grid section-gap no-print">
        <EvolutionLineChart items={filteredSummary.byDate} />
        <OperationalSummary summary={filteredSummary} recordCount={records.length} />
        <TeamProduction items={filteredSummary.byTeam} />
        <BankParticipation items={filteredSummary.byBank} total={filteredSummary.totalMetros} />
      </section>
    </AppShell>
  );
}
