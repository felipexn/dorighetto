"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { Award, BarChart3, CalendarDays, Clock, Fuel, Gauge, Target, TrendingUp } from "lucide-react";
import { PrintReportButton } from "@/components/print-report-button";
import { drillingShiftOptions } from "@/lib/drilling";
import type { ChartItem, DrillingFuelReportEntry, DrillingReportData, DrillingReportFilters, DrillingReportSummary } from "@/lib/drilling-report-data";
import { availabilityLabel, hoursLabel, litersLabel, metersLabel, metersPerHourLabel, shortNumber } from "@/lib/drilling-report-data";

type ChartStyle = CSSProperties & {
  "--bar-width"?: string;
  "--donut"?: string;
};

type Props = {
  initialData: DrillingReportData;
};

function buildParams(filters: DrillingReportFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

function formFilters(form: HTMLFormElement): DrillingReportFilters {
  const formData = new FormData(form);
  const read = (key: string) => String(formData.get(key) ?? "").trim() || undefined;
  return {
    equipe: read("equipe"),
    banco: read("banco"),
    perfuratriz: read("perfuratriz"),
    atividade: read("atividade"),
    turno: read("turno"),
    parada: read("parada"),
    inicio: read("inicio"),
    fim: read("fim")
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

function EvolutionLineChart({
  items,
  title = "Evolução de metros perfurados",
  ariaLabel = "Evolução de metros perfurados",
  unit = "m"
}: {
  items: ChartItem[];
  title?: string;
  ariaLabel?: string;
  unit?: string;
}) {
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
        <div><span>Análise</span><h2>{title}</h2></div>
        <strong>{items.length} datas</strong>
      </div>
      {items.length === 0 ? <p className="muted-text">Sem dados no filtro atual.</p> : null}
      {items.length > 0 ? (
        <div className="line-chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
            {steps.map((step) => {
              const y = padTop + (1 - step) * (plotBottom - padTop);
              return (
                <g key={step}>
                  <line x1={padX} x2={width - padX} y1={y} y2={y} />
                  <text x={padX - 16} y={y + 5}>{shortNumber(max * step)} {unit}</text>
                </g>
              );
            })}
            <path className="line-area" d={areaPath} />
            <path className="line-stroke" d={path} />
            {points.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="7" />)}
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

function OperationalSummary({ summary, recordCount }: { summary: DrillingReportSummary; recordCount: number }) {
  return (
    <section className="panel analytics-card operational-summary-card">
      <div className="analytics-card-head compact-head">
        <div><span>Destaques</span><h2>Resumo operacional</h2></div>
      </div>
      <div className="summary-highlight-list">
        <div><span>Banco mais produtivo</span><strong>{summary.topBank?.label ?? "-"}</strong><small>{summary.topBank ? metersLabel(summary.topBank.value) : "Sem dados"}</small></div>
        <div><span>Perfuratriz líder</span><strong>{summary.topMachine?.label ?? "-"}</strong><small>{summary.topMachine ? metersLabel(summary.topMachine.value) : "Sem dados"}</small></div>
        <div><span>Melhor produção/hora</span><strong>{summary.topHourlyTeam?.label ?? "-"}</strong><small>{summary.topHourlyTeam ? metersPerHourLabel(summary.topHourlyTeam.value) : "Sem uso calculado"}</small></div>
        <div><span>Fichas e furos</span><strong>{recordCount} fichas</strong><small>{summary.totalFuros} furos registrados</small></div>
      </div>
    </section>
  );
}

function ProductionBlocks({
  items,
  title = "Produção por equipe",
  valueLabel = metersLabel
}: {
  items: ChartItem[];
  title?: string;
  valueLabel?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="panel analytics-card team-production-card">
      <div className="analytics-card-head">
        <div><span>Análise</span><h2>{title}</h2></div>
        <strong>Top {Math.min(items.length, 4)}</strong>
      </div>
      <div className="team-block-grid">
        {items.length === 0 ? <p className="muted-text">Sem dados no filtro atual.</p> : null}
        {items.slice(0, 4).map((item, index) => (
          <div className="team-production-block" key={item.label}>
            <span>{index + 1}</span>
            <strong>{item.label || "Não informado"}</strong>
            <small>{valueLabel(item.value)}</small>
            <div style={{ "--bar-width": `${Math.max((item.value / max) * 100, 8)}%` } as ChartStyle} />
          </div>
        ))}
      </div>
    </section>
  );
}

const donutColors = ["#276a4a", "#d39224", "#8f5b13", "#5d7461", "#c46f35", "#1f4f3a"];

function buildDonutGradient(items: ChartItem[], total: number) {
  if (items.length === 0 || total <= 0) return "#e5ded1 0deg 360deg";

  let current = 0;
  const segments = items.slice(0, donutColors.length).map((item, index) => {
    const start = current;
    current += (item.value / total) * 360;
    return `${donutColors[index % donutColors.length]} ${start.toFixed(2)}deg ${current.toFixed(2)}deg`;
  });

  if (current < 360) {
    segments.push(`#e5ded1 ${current.toFixed(2)}deg 360deg`);
  }

  return segments.join(", ");
}

function BankParticipation({ items, total }: { items: ChartItem[]; total: number }) {
  const donutGradient = buildDonutGradient(items, total);

  return (
    <section className="panel analytics-card bank-participation-card">
      <div className="analytics-card-head">
        <div><span>Análise</span><h2>Participação por banco</h2></div>
        <strong>{items.length} grupos</strong>
      </div>
      <div className="donut-layout">
        <div className="donut-chart" style={{ "--donut": donutGradient } as ChartStyle}>
          <strong>{shortNumber(total)} m</strong>
          <span>no período</span>
        </div>
        <div className="donut-legend">
          {items.slice(0, donutColors.length).map((item, index) => {
            const itemPercent = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.label}>
                <span className="legend-dot" style={{ background: donutColors[index % donutColors.length] }} />
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

function ReportRanking({ title, items, valueLabel = metersLabel }: { title: string; items: ChartItem[]; valueLabel?: (value: number) => string }) {
  return (
    <div className="report-ranking-card">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="muted-text">Sem dados no período.</p> : null}
      {items.slice(0, 6).map((item, index) => (
        <div className="report-ranking-row" key={`${title}-${item.label}`}>
          <span>{index + 1}</span>
          <strong>{item.label || "Não informado"}</strong>
          <small>{valueLabel(item.value)}</small>
        </div>
      ))}
    </div>
  );
}

function FuelEntryList({ entries }: { entries: DrillingFuelReportEntry[] }) {
  return (
    <div className="report-daily-table fuel-report-list">
      <h3>Abastecimentos no período</h3>
      {entries.length === 0 ? <p className="muted-text">Nenhum abastecimento registrado no período.</p> : null}
      {entries.map((entry, index) => (
        <div className="report-daily-row" key={`${entry.date}-${entry.machineName}-${index}`}>
          <div>
            <strong>{new Date(entry.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} | {entry.machineName}</strong>
            <small>{entry.notes || "Sem observação"}</small>
          </div>
          <strong>{litersLabel(entry.quantity)}</strong>
        </div>
      ))}
    </div>
  );
}

export function DrillingReportDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = data.filters;
  const options = data.options;
  const loadingLabel = isPending ? "Atualizando..." : "";

  const filterKey = useMemo(() => JSON.stringify(data.filters), [data.filters]);

  function load(filters: DrillingReportFilters) {
    setError("");
    startTransition(async () => {
      try {
        const params = buildParams(filters);
        const response = await fetch(`/api/perfuracao/relatorios?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Não foi possível atualizar os relatórios.");
        const nextData = await response.json() as DrillingReportData;
        setData(nextData);
        const nextUrl = params.toString() ? `/perfuracao/relatorios?${params.toString()}` : "/perfuracao/relatorios";
        window.history.replaceState(null, "", nextUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar os relatórios.");
      }
    });
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = formFilters(event.currentTarget);
    load({ inicio: filters.inicio, fim: filters.fim, turno: filters.turno });
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load(formFilters(event.currentTarget));
  }

  return (
    <div key={filterKey}>
      {data.setupWarning ? <section className="form-error">{data.setupWarning}</section> : null}
      {error ? <section className="form-error">{error}</section> : null}
      {loadingLabel ? <section className="async-status no-print">{loadingLabel}</section> : null}

      <section className="panel report-generator section-gap no-print">
        <div>
          <span className="eyebrow">Prestação de contas</span>
          <h2>Gerar relatório por período</h2>
          <p>Escolha o intervalo desejado. O relatório consolidado só aparece depois que uma data for selecionada.</p>
        </div>
        <form className="report-period-form" onSubmit={submitReport}>
          <label>De<input name="inicio" type="date" defaultValue={selected.inicio ?? ""} /></label>
          <label>Até<input name="fim" type="date" defaultValue={selected.fim ?? ""} /></label>
          <label>Turno
            <select name="turno" defaultValue={selected.turno ?? ""}>
              <option value="">Todos</option>
              {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={isPending}>{isPending ? "Gerando..." : "Gerar relatório"}</button>
        </form>
      </section>

      {data.hasReportPeriod ? (
        <section className="panel consolidated-report print-report-section section-gap">
          <div className="report-title-row">
            <div>
              <span className="eyebrow">Relatório consolidado</span>
              <h2>Prestação de contas da perfuração</h2>
              <p>Período: <strong>{data.reportPeriod}</strong></p>
            </div>
            <PrintReportButton />
          </div>

          <div className="report-summary-grid">
            <div><span>Metros perfurados</span><strong>{metersLabel(data.reportSummary.totalMetros)}</strong></div>
            <div><span>Média por dia</span><strong>{metersLabel(data.reportSummary.mediaDia)}</strong></div>
            <div><span>Média por ficha</span><strong>{metersLabel(data.reportSummary.mediaFicha)}</strong></div>
            <div><span>Média por furo</span><strong>{metersLabel(data.reportSummary.mediaFuro)}</strong></div>
            <div><span>Produção por hora</span><strong>{metersPerHourLabel(data.reportSummary.mediaMetroHora)}</strong><small>{data.reportSummary.totalHorasMotor > 0 ? `${hoursLabel(data.reportSummary.totalHorasMotor)} de uso no período` : "Sem uso calculado válido"}</small></div>
            <div><span>Disponibilidade</span><strong>{availabilityLabel(data.reportSummary.disponibilidade)}</strong><small>{data.reportSummary.totalHorasPrevistas > 0 ? `${hoursLabel(data.reportSummary.totalHorasMotor)} / ${hoursLabel(data.reportSummary.totalHorasPrevistas)}` : "Jornada padrão: 8h"}</small></div>
            <div><span>Horas paradas</span><strong>{hoursLabel(data.reportSummary.totalHorasParadas)}</strong></div>
            <div><span>Média de parada/ficha</span><strong>{hoursLabel(data.reportSummary.mediaHorasParadasFicha)}</strong></div>
            <div><span>Principal motivo de parada</span><strong>{data.reportSummary.topDowntimeReason?.label ?? "-"}</strong><small>{data.reportSummary.topDowntimeReason ? hoursLabel(data.reportSummary.topDowntimeReason.value) : "Sem dados"}</small></div>
            <div><span>Equipe melhor</span><strong>{data.reportSummary.topTeam?.label ?? "-"}</strong><small>{data.reportSummary.topTeam ? metersLabel(data.reportSummary.topTeam.value) : "Sem dados"}</small></div>
            <div><span>Banco mais furado</span><strong>{data.reportSummary.topBank?.label ?? "-"}</strong><small>{data.reportSummary.topBank ? metersLabel(data.reportSummary.topBank.value) : "Sem dados"}</small></div>
            <div><span>Fichas lançadas</span><strong>{data.reportRecordsCount}</strong></div>
            <div><span>Total de furos</span><strong>{data.reportSummary.totalFuros}</strong></div>
            <div><span>Diesel abastecido</span><strong>{litersLabel(data.reportFuelSummary.totalLitros)}</strong></div>
            <div><span>Média de diesel por dia</span><strong>{litersLabel(data.reportFuelSummary.mediaLitrosDia)}</strong></div>
            <div><span>Média por abastecimento</span><strong>{litersLabel(data.reportFuelSummary.mediaLitrosAbastecimento)}</strong></div>
            <div><span>Abastecimentos</span><strong>{data.reportFuelSummary.totalAbastecimentos}</strong><small>{data.reportFuelSummary.diasComAbastecimento} dias com registro</small></div>
            <div><span>Perfuratriz mais abastecida</span><strong>{data.reportFuelSummary.topMachine?.label ?? "-"}</strong><small>{data.reportFuelSummary.topMachine ? litersLabel(data.reportFuelSummary.topMachine.value) : "Sem dados"}</small></div>
          </div>

          <div className="report-details-grid">
            <ReportRanking title="Equipes no período" items={data.reportSummary.byTeam} />
            <ReportRanking title="Bancos no período" items={data.reportSummary.byBank} />
            <ReportRanking title="Perfuratrizes no período" items={data.reportSummary.byMachine} />
            <ReportRanking title="Atividades no período" items={data.reportSummary.byActivity} />
            <ReportRanking title="Produção/hora por equipe" items={data.reportSummary.productionPerHourByTeam} valueLabel={metersPerHourLabel} />
            <ReportRanking title="Produção/hora por perfuratriz" items={data.reportSummary.productionPerHourByMachine} valueLabel={metersPerHourLabel} />
            <ReportRanking title="Paradas por motivo" items={data.reportSummary.byDowntimeReason} valueLabel={hoursLabel} />
            <ReportRanking title="Equipes com horas paradas" items={data.reportSummary.downtimeByTeam} valueLabel={hoursLabel} />
            <ReportRanking title="Diesel por perfuratriz" items={data.reportFuelSummary.byMachine} valueLabel={litersLabel} />
            <ReportRanking title="Diesel por dia" items={data.reportFuelSummary.byDate} valueLabel={litersLabel} />
          </div>

          <FuelEntryList entries={data.reportFuelEntries} />
        </section>
      ) : null}

      <form className="panel filters section-gap no-print" onSubmit={submitFilters}>
        <label>Equipe
          <select name="equipe" defaultValue={selected.equipe ?? ""}>
            <option value="">Todas</option>
            {options.equipes.map((teamName) => <option key={teamName}>{teamName}</option>)}
          </select>
        </label>
        <label>Banco
          <select name="banco" defaultValue={selected.banco ?? ""}>
            <option value="">Todos</option>
            {options.bancos.map((bankName) => <option key={bankName}>{bankName}</option>)}
          </select>
        </label>
        <label>Perfuratriz
          <select name="perfuratriz" defaultValue={selected.perfuratriz ?? ""}>
            <option value="">Todas</option>
            {options.perfuratrizes.map((machineName) => <option key={machineName}>{machineName}</option>)}
          </select>
        </label>
        <label>Atividade
          <select name="atividade" defaultValue={selected.atividade ?? ""}>
            <option value="">Todas</option>
            {options.atividades.map((activityCode) => <option key={activityCode}>{activityCode}</option>)}
          </select>
        </label>
        <label>Turno
          <select name="turno" defaultValue={selected.turno ?? ""}>
            <option value="">Todos</option>
            {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
          </select>
        </label>
        <label>Motivo da parada
          <select name="parada" defaultValue={selected.parada ?? ""}>
            <option value="">Todos</option>
            {options.paradas.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
        </label>
        <label>De<input name="inicio" type="date" defaultValue={selected.inicio ?? ""} /></label>
        <label>Até<input name="fim" type="date" defaultValue={selected.fim ?? ""} /></label>
        <button type="submit" disabled={isPending}>{isPending ? "Filtrando..." : "Filtrar gráficos"}</button>
      </form>

      <section className="analytics-metric-grid section-gap no-print">
        <MetricCard icon={<Target size={18} />} label="Total perfurado" value={metersLabel(data.filteredSummary.totalMetros)} />
        <MetricCard icon={<TrendingUp size={18} />} label="Média por dia" value={metersLabel(data.filteredSummary.mediaDia)} />
        <MetricCard icon={<Gauge size={18} />} label="Média por ficha" value={metersLabel(data.filteredSummary.mediaFicha)} />
        <MetricCard icon={<BarChart3 size={18} />} label="Média por furo" value={metersLabel(data.filteredSummary.mediaFuro)} />
        <MetricCard icon={<Gauge size={18} />} label="Produção por hora" value={metersPerHourLabel(data.filteredSummary.mediaMetroHora)} />
        <MetricCard icon={<Clock size={18} />} label="Disponibilidade" value={availabilityLabel(data.filteredSummary.disponibilidade)} />
        <MetricCard icon={<Clock size={18} />} label="Horas paradas" value={hoursLabel(data.filteredSummary.totalHorasParadas)} />
        <MetricCard icon={<Award size={18} />} label="Equipe líder" value={data.filteredSummary.topTeam?.label ?? "-"} />
        <MetricCard icon={<CalendarDays size={18} />} label="Melhor dia" value={data.filteredSummary.bestDay?.label ?? "-"} />
      </section>

      <section className="analytics-dashboard-grid section-gap no-print">
        <EvolutionLineChart items={data.filteredSummary.byDate} />
        <OperationalSummary summary={data.filteredSummary} recordCount={data.recordsCount} />
        <ProductionBlocks items={data.filteredSummary.byTeam} />
        <BankParticipation items={data.filteredSummary.byBank} total={data.filteredSummary.totalMetros} />
      </section>

      <section className="analytics-section-heading section-gap no-print">
        <span className="eyebrow">Abastecimento</span>
        <h2>Análise de diesel</h2>
        <p>Consumo registrado no período e na perfuratriz selecionada.</p>
      </section>

      <section className="analytics-metric-grid section-gap no-print">
        <MetricCard icon={<Fuel size={18} />} label="Diesel abastecido" value={litersLabel(data.filteredFuelSummary.totalLitros)} />
        <MetricCard icon={<TrendingUp size={18} />} label="Média por dia" value={litersLabel(data.filteredFuelSummary.mediaLitrosDia)} />
        <MetricCard icon={<Gauge size={18} />} label="Média por abastecimento" value={litersLabel(data.filteredFuelSummary.mediaLitrosAbastecimento)} />
        <MetricCard icon={<CalendarDays size={18} />} label="Abastecimentos" value={String(data.filteredFuelSummary.totalAbastecimentos)} />
        <MetricCard icon={<Award size={18} />} label="Mais abastecida" value={data.filteredFuelSummary.topMachine?.label ?? "-"} />
        <MetricCard icon={<CalendarDays size={18} />} label="Dias abastecidos" value={String(data.filteredFuelSummary.diasComAbastecimento)} />
      </section>

      <section className="analytics-dashboard-grid section-gap no-print">
        <EvolutionLineChart
          items={data.filteredFuelSummary.byDate}
          title="Evolução diária do diesel"
          ariaLabel="Evolução diária dos litros de diesel abastecidos"
          unit="L"
        />
        <ProductionBlocks
          items={data.filteredFuelSummary.byMachine}
          title="Diesel por perfuratriz"
          valueLabel={litersLabel}
        />
      </section>
    </div>
  );
}

