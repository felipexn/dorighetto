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
  let bancos: { bankName: string }[] = [];
  let perfuratrizes: { machineName: string }[] = [];
  let atividades: { activityCode: string }[] = [];
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
        bankName: params.banco || undefined,
        machineName: params.perfuratriz || undefined,
        activityCode: params.atividade || undefined,
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
    bancos = await prisma.drillingRecord.findMany({
      distinct: ["bankName"],
      select: { bankName: true },
      orderBy: { bankName: "asc" }
    });
    perfuratrizes = await prisma.drillingRecord.findMany({
      distinct: ["machineName"],
      select: { machineName: true },
      orderBy: { machineName: "asc" }
    });
    atividades = await prisma.drillingRecord.findMany({
      distinct: ["activityCode"],
      select: { activityCode: true },
      orderBy: { activityCode: "asc" }
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
  const totalFuros = records.reduce((acc, record) => acc + record.holes.length, 0);
  const uniqueDates = new Set(records.map((record) => record.date.toISOString().slice(0, 10)));
  const mediaDia = uniqueDates.size > 0 ? totalMetros / uniqueDates.size : 0;

  function groupMetersBy(key: "teamName" | "bankName" | "machineName" | "activityCode") {
    const map = new Map<string, number>();
    for (const record of records) {
      const meters = record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
      map.set(record[key], (map.get(record[key]) ?? 0) + meters);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  const byTeam = groupMetersBy("teamName");
  const byBank = groupMetersBy("bankName");
  const byMachine = groupMetersBy("machineName");
  const byActivity = groupMetersBy("activityCode");
  const byDate = Array.from(records.reduce((map, record) => {
    const label = formatDate(record.date);
    const meters = record.holes.reduce((acc, hole) => acc + decimalToNumber(hole.meters), 0);
    map.set(label, (map.get(label) ?? 0) + meters);
    return map;
  }, new Map<string, number>()).entries()).map(([label, value]) => ({ label, value }));
  const chartMax = Math.max(...[...byTeam, ...byBank, ...byMachine, ...byDate].map((item) => item.value), 1);
  const topTeam = byTeam[0];
  const topBank = byBank[0];

  function metersLabel(value: number) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  }

  function BarList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
    return (
      <section className="panel chart-card">
        <div className="table-head">
          <h2>{title}</h2>
          <span>{items.length} itens</span>
        </div>
        <div className="bar-list">
          {items.length === 0 ? <p className="muted-text">Sem dados no filtro atual.</p> : null}
          {items.map((item) => (
            <div className="bar-item" key={`${title}-${item.label}`}>
              <div>
                <strong>{item.label || "Não informado"}</strong>
                <span>{metersLabel(item.value)}</span>
              </div>
              <div className="bar-track"><span style={{ width: `${Math.max((item.value / chartMax) * 100, 4)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Perfuração"
        title="Ficha de perfuração"
        description="Registro diário por equipe com perfuratriz, banco, código da atividade, motor inicial/final e furos."
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
          <label>Código da atividade<input name="activityCode" placeholder="Ex: AT-234" defaultValue={params.prefillAtividade ?? ""} required /></label>
          <label>H. motor inicial<input name="motorStart" placeholder="Ex: 1245" defaultValue={params.prefillMotorInicial ?? ""} required /></label>
          <label>H. motor final<input name="motorEnd" placeholder="Ex: 1276" defaultValue={params.prefillMotorFinal ?? ""} required /></label>
          <label className="wide-field">Observação<input name="notes" placeholder="Opcional" /></label>
          <PerfuracaoFormFields />
          <button type="submit">Salvar ficha do dia</button>
        </form>
      ) : null}

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
        <label>Banco
          <select name="banco" defaultValue={params.banco ?? ""}>
            <option value="">Todos</option>
            {bancos.map((item) => <option key={item.bankName}>{item.bankName}</option>)}
          </select>
        </label>
        <label>Perfuratriz
          <select name="perfuratriz" defaultValue={params.perfuratriz ?? ""}>
            <option value="">Todas</option>
            {perfuratrizes.map((item) => <option key={item.machineName}>{item.machineName}</option>)}
          </select>
        </label>
        <label>Atividade
          <select name="atividade" defaultValue={params.atividade ?? ""}>
            <option value="">Todas</option>
            {atividades.map((item) => <option key={item.activityCode}>{item.activityCode}</option>)}
          </select>
        </label>
        <label>De<input name="inicio" type="date" defaultValue={params.inicio ?? ""} /></label>
        <label>Até<input name="fim" type="date" defaultValue={params.fim ?? ""} /></label>
        <button type="submit">Filtrar</button>
      </form>

      <section className="drill-kpi-grid section-gap">
        <div className="kpi"><span>Total perfurado</span><strong>{metersLabel(totalMetros)}</strong></div>
        <div className="kpi"><span>Média por dia</span><strong>{metersLabel(mediaDia)}</strong></div>
        <div className="kpi"><span>Equipe líder</span><strong>{topTeam ? topTeam.label : "-"}</strong></div>
        <div className="kpi"><span>Banco líder</span><strong>{topBank ? topBank.label : "-"}</strong></div>
        <div className="kpi"><span>Total de furos</span><strong>{totalFuros}</strong></div>
        <div className="kpi"><span>Fichas lançadas</span><strong>{records.length}</strong></div>
      </section>

      <section className="chart-grid section-gap">
        <BarList title="Metros por equipe" items={byTeam} />
        <BarList title="Metros por banco" items={byBank} />
        <BarList title="Metros por perfuratriz" items={byMachine} />
        <BarList title="Evolução diária" items={byDate} />
        <BarList title="Ranking de equipes" items={byTeam.slice(0, 5)} />
        <BarList title="Ranking de bancos" items={byBank.slice(0, 5)} />
        <BarList title="Metros por atividade" items={byActivity} />
      </section>

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Registros diários</h2>
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





