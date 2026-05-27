import { Trash2 } from "lucide-react";
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

type SearchParams = Promise<{
  equipe?: string;
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

  const startDate = params.inicio ? new Date(`${params.inicio}T00:00:00.000Z`) : undefined;
  const endDate = params.fim ? new Date(`${params.fim}T23:59:59.999Z`) : undefined;

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
      where: {
        teamName: params.equipe || undefined,
        date: startDate || endDate ? { gte: startDate, lte: endDate } : undefined
      },
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

  const totalMetros = records.reduce(
    (acc, record) => acc + record.holes.reduce((holeAcc, hole) => holeAcc + decimalToNumber(hole.meters), 0),
    0
  );

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Perfuracao"
        title="Ficha de perfuracao"
        description="Registro diario por equipe com perfuratriz, banco, codigo da atividade, motor inicial/final e furos."
      />
      {actionError ? <section className="form-error">{actionError}</section> : null}
      {setupWarning ? <section className="form-error">{setupWarning}</section> : null}

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
          <label>Codigo da atividade<input name="activityCode" placeholder="Ex: AT-234" defaultValue={params.prefillAtividade ?? ""} required /></label>
          <label>H. motor inicial<input name="motorStart" placeholder="Ex: 1245" defaultValue={params.prefillMotorInicial ?? ""} required /></label>
          <label>H. motor final<input name="motorEnd" placeholder="Ex: 1276" defaultValue={params.prefillMotorFinal ?? ""} required /></label>
          <label className="wide-field">Observacao<input name="notes" placeholder="Opcional" /></label>
          <PerfuracaoFormFields />
          <button type="submit">Salvar ficha do dia</button>
        </form>
      ) : null}

      {isAdmin && quickTeams.length > 0 ? (
        <section className="panel section-gap">
          <div className="table-head">
            <h2>Continuar equipe existente</h2>
            <span>Preenche os campos para lancar hoje</span>
          </div>
          <div className="quick-team-list">
            {quickTeams.map((item) => (
              <Link
                key={item.teamName}
                className="quick-team-chip"
                href={`/perfuracao?prefillEquipe=${encodeURIComponent(item.teamName)}&prefillPerfuratriz=${encodeURIComponent(item.machineName)}&prefillBanco=${encodeURIComponent(item.bankName)}&prefillAtividade=${encodeURIComponent(item.activityCode)}&prefillMotorInicial=${encodeURIComponent(item.motorStart)}&prefillMotorFinal=${encodeURIComponent(item.motorEnd)}`}
              >
                {item.teamName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form className="panel filters section-gap">
        <label>Equipe
          <select name="equipe" defaultValue={params.equipe ?? ""}>
            <option value="">Todas</option>
            {equipes.map((item) => <option key={item.teamName}>{item.teamName}</option>)}
          </select>
        </label>
        <label>De<input name="inicio" type="date" defaultValue={params.inicio ?? ""} /></label>
        <label>Ate<input name="fim" type="date" defaultValue={params.fim ?? ""} /></label>
        <button type="submit">Filtrar</button>
      </form>

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Total perfurado</h2>
          <strong>{totalMetros.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>
        </div>
      </section>

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Registros diarios</h2>
          <span>{records.length} fichas</span>
        </div>
        <div className="drill-list">
          {records.map((record) => {
            const total = record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
            return (
              <article className="drill-card" key={record.id}>
                <header>
                  <div>
                    <strong>{record.teamName}</strong>
                    <span>{formatDate(record.date)} | {record.machineName}</span>
                  </div>
                  <strong>{total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>
                </header>
                <div className="drill-meta">
                  <span>Banco: {record.bankName}</span>
                  <span>Atividade: {record.activityCode}</span>
                  <span>H. motor: {record.motorStart} - {record.motorEnd}</span>
                </div>
                <div className="drill-holes">
                  <div className="drill-hole header"><span>Furo</span><span>Metros</span></div>
                  {record.holes.map((hole) => (
                    <div className="drill-hole" key={hole.id}>
                      <span>{hole.holeCode}</span>
                      <strong>{decimalToNumber(hole.meters).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>
                    </div>
                  ))}
                </div>
                {record.notes ? <p>{record.notes}</p> : null}
                {isAdmin ? (
                  <form action={deleteDrillingRecordAction}>
                    <input type="hidden" name="id" value={record.id} />
                    <button className="danger-button inline-danger" type="submit"><Trash2 size={16} /> Deletar ficha</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
