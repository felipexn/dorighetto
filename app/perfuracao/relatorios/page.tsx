import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { decimalToNumber, formatDate } from "@/lib/format";

type SearchParams = Promise<{
  equipe?: string;
  banco?: string;
  perfuratriz?: string;
  atividade?: string;
  inicio?: string;
  fim?: string;
}>;

type ChartItem = { label: string; value: number };

function metersLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

function BarList({ title, items, max }: { title: string; items: ChartItem[]; max: number }) {
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
            <div className="bar-track"><span style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function RelatoriosPerfuracaoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const startDate = params.inicio ? new Date(`${params.inicio}T00:00:00.000Z`) : undefined;
  const endDate = params.fim ? new Date(`${params.fim}T23:59:59.999Z`) : undefined;

  let records: {
    date: Date;
    teamName: string;
    machineName: string;
    bankName: string;
    activityCode: string;
    holes: { meters: number | { toNumber: () => number } }[];
  }[] = [];
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
  } catch {
    setupWarning = "Módulo criado. Falta apenas sincronizar o schema no banco para listar os relatórios.";
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
  const chartMax = Math.max(...[...byTeam, ...byBank, ...byMachine, ...byDate, ...byActivity].map((item) => item.value), 1);
  const topTeam = byTeam[0];
  const topBank = byBank[0];

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios de perfuração"
        description="Analise a produtividade por período, equipe, banco, perfuratriz e atividade."
        actions={<Link className="button secondary" href="/perfuracao"><ArrowLeft size={18} /> Voltar para fichas</Link>}
      />
      {setupWarning ? <section className="form-error">{setupWarning}</section> : null}

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
        <BarList title="Metros por equipe" items={byTeam} max={chartMax} />
        <BarList title="Metros por banco" items={byBank} max={chartMax} />
        <BarList title="Metros por perfuratriz" items={byMachine} max={chartMax} />
        <BarList title="Evolução diária" items={byDate} max={chartMax} />
        <BarList title="Ranking de equipes" items={byTeam.slice(0, 5)} max={chartMax} />
        <BarList title="Ranking de bancos" items={byBank.slice(0, 5)} max={chartMax} />
        <BarList title="Metros por atividade" items={byActivity} max={chartMax} />
      </section>
    </AppShell>
  );
}
