import { BarChart3, ChevronDown, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/ui";
import { PerfuracaoFormFields } from "@/components/perfuracao-form";
import { createDrillingRecordAction, deleteDrillingRecordAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { decimalToNumber, formatDate } from "@/lib/format";
import { toDateInput } from "@/lib/diarias";
import {
  defaultDrillingMachineOptions,
  drillingShiftOptions,
  formatDrillingShift,
  normalizeDrillingBankName,
  normalizeDrillingMachineName,
  normalizeDrillingShift
} from "@/lib/drilling";

type SearchParams = Promise<{
  equipe?: string;
  banco?: string;
  perfuratriz?: string;
  atividade?: string;
  inicio?: string;
  fim?: string;
  erro?: string;
  prefillEquipe?: string;
  prefillPerfuratriz?: string;
  prefillBanco?: string;
  prefillAtividade?: string;
  prefillTurno?: string;
  prefillMotorInicial?: string;
  prefillMotorFinal?: string;
}>;

export default async function PerfuracaoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireModule("perfuracao");
  const params = await searchParams;
  const canWrite = session.permissions.canWriteDrilling;
  const actionError = params.erro ? decodeURIComponent(params.erro) : "";


  let records: {
    id: string;
    date: Date;
    teamName: string;
    machineName: string;
    bankName: string;
    activityCode: string;
    shift: string;
    motorStart: string;
    motorEnd: string;
    notes: string | null;
    holes: { id: string; holeCode: string; meters: number | { toNumber: () => number } }[];
    downtimes: { id: string; reason: string; hours: number | { toNumber: () => number } }[];
  }[] = [];
  let equipes: { teamName: string }[] = [];
  let quickTeams: {
    teamName: string;
    machineName: string;
    bankName: string;
    activityCode: string;
    shift: string;
    motorStart: string;
    motorEnd: string;
  }[] = [];
  let setupWarning = "";

  try {

    records = await prisma.drillingRecord.findMany({
      include: {
        holes: {
          orderBy: { createdAt: "asc" }
        },
        downtimes: {
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [{ date: "desc" }, { teamName: "asc" }]
    });

    equipes = await prisma.drillingRecord.findMany({
      distinct: ["teamName"],
      select: { teamName: true },
      orderBy: { teamName: "asc" }
    });

    const latestRows = await prisma.drillingRecord.findMany({
      select: {
        teamName: true,
        machineName: true,
        bankName: true,
        activityCode: true,
        shift: true,
        motorStart: true,
        motorEnd: true
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200
    });

    const seen = new Set<string>();
    quickTeams = latestRows.filter((row) => {
      if (seen.has(row.teamName)) return false;
      seen.add(row.teamName);
      return true;
    });
  } catch {
    setupWarning = "Não foi possível consultar a perfuração. Rode a sincronização do banco e tente novamente.";
  }

  function metersLabel(value: number) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  }

  function hoursLabel(value: number) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
  }

  const recordsByDate = Array.from(records.reduce((map, record) => {
    const dateKey = record.date.toISOString().slice(0, 10);
    const current = map.get(dateKey) ?? {
      label: formatDate(record.date),
      records: [] as typeof records,
      totalMeters: 0,
      totalHoles: 0
    };
    const meters = record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
    current.records.push(record);
    current.totalMeters += meters;
    current.totalHoles += record.holes.length;
    map.set(dateKey, current);
    return map;
  }, new Map<string, { label: string; records: typeof records; totalMeters: number; totalHoles: number }>()).entries())
    .map(([dateKey, group]) => ({ dateKey, ...group }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const currentMonthParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const currentYear = currentMonthParts.find((part) => part.type === "year")?.value ?? "";
  const currentMonth = currentMonthParts.find((part) => part.type === "month")?.value ?? "";
  const currentMonthKey = `${currentYear}-${currentMonth}`;
  const recordsByMonth = Array.from(recordsByDate.reduce((map, dateGroup) => {
    const monthKey = dateGroup.dateKey.slice(0, 7);
    const current = map.get(monthKey) ?? {
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${monthKey}-01T00:00:00.000Z`)),
      dates: [] as typeof recordsByDate,
      totalRecords: 0,
      totalHoles: 0,
      totalMeters: 0
    };
    current.dates.push(dateGroup);
    current.totalRecords += dateGroup.records.length;
    current.totalHoles += dateGroup.totalHoles;
    current.totalMeters += dateGroup.totalMeters;
    map.set(monthKey, current);
    return map;
  }, new Map<string, {
    label: string;
    dates: typeof recordsByDate;
    totalRecords: number;
    totalHoles: number;
    totalMeters: number;
  }>()).entries())
    .map(([monthKey, group]) => ({
      monthKey,
      ...group,
      label: group.label.charAt(0).toUpperCase() + group.label.slice(1)
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const machineOptions = Array.from(new Set([
    ...defaultDrillingMachineOptions,
    ...records.map((record) => normalizeDrillingMachineName(record.machineName)).filter(Boolean),
    ...(params.prefillPerfuratriz ? [normalizeDrillingMachineName(params.prefillPerfuratriz)] : [])
  ]));
  const selectedMachine = params.prefillPerfuratriz
    ? normalizeDrillingMachineName(params.prefillPerfuratriz)
    : defaultDrillingMachineOptions[0];
  const selectedShift = normalizeDrillingShift(params.prefillTurno ?? "DIA");

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Perfuração"
        title="Ficha de perfuração"
        description="Cadastre as fichas do dia e acompanhe os registros lançados por data."
        actions={(
          <>
            <Link className="button secondary" href="/perfuracao/relatorios"><BarChart3 size={18} /> Relatórios</Link>
          </>
        )}
      />
      {actionError ? <section className="form-error">{actionError}</section> : null}
      {setupWarning ? <section className="form-error">{setupWarning}</section> : null}
      {canWrite && quickTeams.length > 0 ? (
        <section className="panel section-gap">
          <div className="table-head">
            <h2>Continuar equipe existente</h2>
            <span>Preencha os campos para lançar hoje</span>
          </div>
          <div className="quick-team-list">
            {quickTeams.map((item) => (
              <Link
                key={item.teamName}
                className="quick-team-chip"
                href={`/perfuracao?prefillEquipe=${encodeURIComponent(item.teamName)}&prefillPerfuratriz=${encodeURIComponent(normalizeDrillingMachineName(item.machineName))}&prefillBanco=${encodeURIComponent(normalizeDrillingBankName(item.bankName))}&prefillAtividade=${encodeURIComponent(item.activityCode)}&prefillTurno=${encodeURIComponent(normalizeDrillingShift(item.shift))}&prefillMotorInicial=${encodeURIComponent(item.motorStart)}&prefillMotorFinal=${encodeURIComponent(item.motorEnd)}`}
              >
                {item.teamName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}


      {canWrite && !setupWarning ? (
        <form className="panel perf-form" action={createDrillingRecordAction}>
          <label>Data<input name="date" type="date" defaultValue={toDateInput(new Date())} /></label>
          <label>Equipe
            <input name="teamName" list="team-options" placeholder="Ex: EQUIPE 01" defaultValue={params.prefillEquipe ?? ""} required />
            <datalist id="team-options">
              {equipes.map((item) => <option key={item.teamName} value={item.teamName} />)}
            </datalist>
          </label>
          <label>Perfuratriz
            <input name="machineName" list="machine-options" placeholder="Ex: 80" defaultValue={selectedMachine} required />
            <datalist id="machine-options">
              {machineOptions.map((machine) => <option key={machine} value={machine} />)}
            </datalist>
          </label>
          <label>Banco<input name="bankName" placeholder="Ex: BANCO CELESTE" defaultValue={params.prefillBanco ?? ""} required /></label>
          <label>Turno
            <select name="shift" defaultValue={selectedShift} required>
              {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
            </select>
          </label>
          <label>H. motor inicial<input name="motorStart" placeholder="Ex: 1245" defaultValue={params.prefillMotorInicial ?? ""} required /></label>
          <label>H. motor final<input name="motorEnd" placeholder="Ex: 1276" defaultValue={params.prefillMotorFinal ?? ""} required /></label>
          <label>Código da atividade<input name="activityCode" placeholder="Ex: AT-234" defaultValue={params.prefillAtividade ?? ""} required /></label>
          <label className="wide-field">Observação<input name="notes" placeholder="Opcional" /></label>
          <PerfuracaoFormFields />
          <button type="submit">Salvar ficha do dia</button>
        </form>
      ) : null}

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Registros de perfuração</h2>
          <span>{records.length} fichas em {recordsByMonth.length} meses</span>
        </div>
        <div className="drill-month-list">
          {recordsByMonth.map((month) => (
            <details className="drill-month-group" key={month.monthKey} open={month.monthKey === currentMonthKey}>
              <summary>
                <div>
                  <strong>{month.label}</strong>
                  <span>{month.totalRecords} fichas | {month.totalHoles} furos | {metersLabel(month.totalMeters)}</span>
                </div>
                <ChevronDown size={20} />
              </summary>

              <div className="drill-date-list">
                {month.dates.map((group) => (
                  <details className="drill-date-group" key={group.dateKey}>
                    <summary>
                      <div>
                        <strong>{group.label}</strong>
                        <span>{group.records.length} fichas | {group.totalHoles} furos | {metersLabel(group.totalMeters)}</span>
                      </div>
                      <ChevronDown size={18} />
                    </summary>

                    <div className="drill-list">
                      {group.records.map((record) => {
                        const total = record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
                        const downtimeTotal = record.downtimes.reduce((acc, downtime) => acc + decimalToNumber(downtime.hours), 0);
                        return (
                          <details className="drill-record-group" key={record.id}>
                            <summary>
                              <div className="drill-record-title">
                                <strong>{record.teamName}</strong>
                                <span>{normalizeDrillingMachineName(record.machineName)} | Banco {normalizeDrillingBankName(record.bankName)}</span>
                              </div>
                              <div className="drill-record-total">
                                <strong>{metersLabel(total)}</strong>
                                <span>{record.holes.length} furos</span>
                              </div>
                              <ChevronDown size={18} />
                            </summary>

                            <div className="drill-record-body">
                              <div className="drill-meta">
                                <span>Banco: {normalizeDrillingBankName(record.bankName)}</span>
                                <span>Turno: {formatDrillingShift(record.shift)}</span>
                                <span>Atividade: {record.activityCode}</span>
                                <span>H. motor: {record.motorStart} - {record.motorEnd}</span>
                              </div>

                              <div className="drill-holes">
                                <div className="drill-hole header"><span>ID do furo</span><span>Metros</span></div>
                                {record.holes.length > 0 ? (
                                  record.holes.map((hole) => (
                                    <div className="drill-hole" key={hole.id}>
                                      <span>{hole.holeCode}</span>
                                      <strong>{decimalToNumber(hole.meters).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>
                                    </div>
                                  ))
                                ) : (
                                  <div className="drill-hole empty"><span>Sem furos preenchidos</span><strong>Observação</strong></div>
                                )}
                              </div>

                              {record.downtimes.length > 0 ? (
                                <div className="drill-downtime-list">
                                  <strong>Horas paradas: {hoursLabel(downtimeTotal)}</strong>
                                  {record.downtimes.map((downtime) => (
                                    <span key={downtime.id}>{downtime.reason}: {hoursLabel(decimalToNumber(downtime.hours))}</span>
                                  ))}
                                </div>
                              ) : null}

                              {record.notes ? <p>{record.notes}</p> : null}
                              {canWrite ? (
                                <div className="drill-card-actions">
                                  <Link className="button secondary compact" href={`/perfuracao/${record.id}/editar`}><Pencil size={16} /> Editar</Link>
                                  <form action={deleteDrillingRecordAction}>
                                    <input type="hidden" name="id" value={record.id} />
                                    <ConfirmSubmitButton className="danger-button inline-danger" message={`Deletar a ficha da equipe ${record.teamName} em ${formatDate(record.date)}?`}><Trash2 size={16} /> Deletar ficha</ConfirmSubmitButton>
                                  </form>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
          {recordsByMonth.length === 0 ? <p className="muted-text">Nenhuma ficha de perfuração encontrada.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}

