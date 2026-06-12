import { BarChart3, ChevronDown, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { PerfuracaoFormFields } from "@/components/perfuracao-form";
import { createDrillingRecordAction, deleteDrillingRecordAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { decimalToNumber, formatDate } from "@/lib/format";
import { toDateInput } from "@/lib/diarias";
import { normalizeDrillingBankName } from "@/lib/drilling";

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
  prefillMotorInicial?: string;
  prefillMotorFinal?: string;
}>;

export default async function PerfuracaoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.role === "ADMIN";
  const actionError = params.erro ? decodeURIComponent(params.erro) : "";


  let records: {
    id: string;
    date: Date;
    teamName: string;
    machineName: string;
    bankName: string;
    activityCode: string;
    motorStart: string;
    motorEnd: string;
    notes: string | null;
    holes: { id: string; holeCode: string; meters: number | { toNumber: () => number } }[];
  }[] = [];
  let equipes: { teamName: string }[] = [];
  let quickTeams: {
    teamName: string;
    machineName: string;
    bankName: string;
    activityCode: string;
    motorStart: string;
    motorEnd: string;
  }[] = [];
  let setupWarning = "";

  try {
    await ensureDrillingSchema(prisma);

    records = await prisma.drillingRecord.findMany({
      include: {
        holes: {
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
    setupWarning = "Modulo criado. Falta apenas sincronizar o schema no banco para salvar e listar dados.";
  }

  function metersLabel(value: number) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
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

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Perfuração"
        title="Ficha de perfuração"
        description="Cadastre as fichas do dia e acompanhe os registros lançados por data."
        actions={<Link className="button secondary" href="/perfuracao/relatorios"><BarChart3 size={18} /> Relatórios</Link>}
      />
      {actionError ? <section className="form-error">{actionError}</section> : null}
      {setupWarning ? <section className="form-error">{setupWarning}</section> : null}
      {isAdmin && quickTeams.length > 0 ? (
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
                href={`/perfuracao?prefillEquipe=${encodeURIComponent(item.teamName)}&prefillPerfuratriz=${encodeURIComponent(item.machineName)}&prefillBanco=${encodeURIComponent(normalizeDrillingBankName(item.bankName))}&prefillAtividade=${encodeURIComponent(item.activityCode)}&prefillMotorInicial=${encodeURIComponent(item.motorStart)}&prefillMotorFinal=${encodeURIComponent(item.motorEnd)}`}
              >
                {item.teamName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}


      {isAdmin && !setupWarning ? (
        <form className="panel perf-form" action={createDrillingRecordAction}>
          <label>Data<input name="date" type="date" defaultValue={toDateInput(new Date())} /></label>
          <label>Equipe
            <input name="teamName" list="team-options" placeholder="Ex: EQUIPE 01" defaultValue={params.prefillEquipe ?? ""} required />
            <datalist id="team-options">
              {equipes.map((item) => <option key={item.teamName} value={item.teamName} />)}
            </datalist>
          </label>
          <label>Perfuratriz<input name="machineName" placeholder="Ex: PERF 080" defaultValue={params.prefillPerfuratriz ?? ""} required /></label>
          <label>Banco<input name="bankName" placeholder="Ex: BANCO CELESTE" defaultValue={params.prefillBanco ?? ""} required /></label>
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
          <h2>Registros diários</h2>
          <span>{records.length} fichas em {recordsByDate.length} datas</span>
        </div>
        <div className="drill-date-list">
          {recordsByDate.map((group) => (
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
                  return (
                    <article className="drill-card" key={record.id}>
                      <header>
                        <div>
                          <strong>{record.teamName}</strong>
                          <span>{record.machineName}</span>
                        </div>
                        <strong>{metersLabel(total)}</strong>
                      </header>
                      <div className="drill-meta">
                        <span>Banco: {normalizeDrillingBankName(record.bankName)}</span>
                        <span>Atividade: {record.activityCode}</span>
                        <span>H. motor: {record.motorStart} - {record.motorEnd}</span>
                      </div>

                      <details className="drill-holes-toggle">
                        <summary>
                          <span>Ver furos preenchidos</span>
                          <strong>{record.holes.length} furos | {metersLabel(total)}</strong>
                          <ChevronDown size={16} />
                        </summary>
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
                      </details>

                      {record.notes ? <p>{record.notes}</p> : null}
                      {isAdmin ? (
                        <div className="drill-card-actions">
                          <Link className="button secondary compact" href={`/perfuracao/${record.id}/editar`}><Pencil size={16} /> Editar</Link>
                          <form action={deleteDrillingRecordAction}>
                            <input type="hidden" name="id" value={record.id} />
                            <button className="danger-button inline-danger" type="submit"><Trash2 size={16} /> Deletar ficha</button>
                          </form>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </section>
    </AppShell>
  );
}







