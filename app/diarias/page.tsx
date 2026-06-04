import Link from "next/link";
import { ChevronDown, Download, FileClock, Pencil, Trash2, Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { createDailyEntryAction, deleteDailyEntryAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { toDateInput } from "@/lib/diarias";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

type SearchParams = Promise<{
  funcionario?: string;
  funcao?: string;
  status?: string;
}>;

export default async function DiariasPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.role === "ADMIN";

  const entries = await prisma.dailyEntry.findMany({
    where: {
      employeeName: params.funcionario || undefined,
      role: params.funcao === "AJUDANTE" || params.funcao === "OPERADOR" ? params.funcao : undefined,
      status: params.status === "PAGO" || params.status === "PENDENTE" ? params.status : "PENDENTE"
    },
    include: { closure: true },
    orderBy: [{ date: "desc" }, { employeeName: "asc" }]
  });

  const employees = await prisma.dailyEntry.findMany({
    distinct: ["employeeName"],
    select: { employeeName: true },
    orderBy: { employeeName: "asc" }
  });

  const isPaidFilter = params.status === "PAGO";
  const paidGroups = Array.from(entries.reduce((map, entry) => {
    const paidAt = entry.closure?.paidAt;
    if (!paidAt) return map;
    const key = paidAt.toISOString().slice(0, 10);
    const current = map.get(key) ?? {
      label: formatDate(paidAt),
      entries: [] as typeof entries,
      total: 0
    };
    current.entries.push(entry);
    current.total += decimalToNumber(entry.dayTotal);
    map.set(key, current);
    return map;
  }, new Map<string, { label: string; entries: typeof entries; total: number }>()).entries())
    .map(([dateKey, group]) => ({ dateKey, ...group }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const pending = await prisma.dailyEntry.groupBy({
    by: ["employeeName", "role"],
    where: { status: "PENDENTE" },
    _count: { id: true },
    _sum: { dailyValue: true, overtimeTotal: true, dayTotal: true },
    orderBy: { employeeName: "asc" }
  });

  return (
    <AppShell active="diarias" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Diárias"
        title="Diárias pendentes"
        description="Lance os dias trabalhados. Ao pagar um funcionário, o sistema gera o recibo individual e limpa os pendentes dele."
        actions={<Link className="button secondary" href="/diarias/historico"><FileClock size={18} /> Histórico</Link>}
      />

      {isAdmin ? (
        <form className="panel daily-form" action={createDailyEntryAction}>
          <label>Data<input name="date" type="date" defaultValue={toDateInput(new Date())} required /></label>
          <label>Funcionário
            <input name="employeeName" list="employee-options" placeholder="Selecione ou digite novo nome" required />
            <datalist id="employee-options">
              {employees.map((employee) => <option key={employee.employeeName} value={employee.employeeName} />)}
            </datalist>
          </label>
          <label>Função<select name="role" defaultValue="AJUDANTE"><option>AJUDANTE</option><option>OPERADOR</option></select></label>
          <label>Diária<input name="dailyValue" placeholder="0,00" required /></label>
          <label>H. extra<input name="overtimeHours" placeholder="0" /></label>
          <label className="wide-field">Observação<input name="notes" placeholder="Opcional" /></label>
          <button type="submit">Adicionar diária</button>
        </form>
      ) : null}

      <form className="panel filters section-gap">
        <label>Funcionário
          <select name="funcionario" defaultValue={params.funcionario ?? ""}>
            <option value="">Todos</option>
            {employees.map((employee) => <option key={employee.employeeName}>{employee.employeeName}</option>)}
          </select>
        </label>
        <label>Função
          <select name="funcao" defaultValue={params.funcao ?? ""}>
            <option value="">Todas</option>
            <option>AJUDANTE</option>
            <option>OPERADOR</option>
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={params.status ?? "PENDENTE"}>
            <option>PENDENTE</option>
            <option>PAGO</option>
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>

      <section className="panel table-panel section-gap">
        <div className="table-head">
          <h2>{isPaidFilter ? "Diárias pagas" : "Planilha geral"}</h2>
          <span>{entries.length} registros</span>
        </div>

        {isPaidFilter ? (
          <div className="paid-daily-groups">
            {paidGroups.length === 0 ? <p className="muted-text">Nenhuma diária paga encontrada neste filtro.</p> : null}
            {paidGroups.map((group) => (
              <details className="paid-daily-group" key={group.dateKey}>
                <summary>
                  <div>
                    <strong>{group.label}</strong>
                    <span>{group.entries.length} diárias pagas | {formatCurrency(group.total)}</span>
                  </div>
                  <ChevronDown size={18} />
                </summary>

                <div className="paid-daily-list">
                  {group.entries.map((entry) => (
                    <article className="paid-daily-card" key={entry.id}>
                      <header>
                        <div>
                          <strong>{entry.employeeName}</strong>
                          <span>{entry.role} | Trabalhado em {formatDate(entry.date)}</span>
                        </div>
                        <strong>{formatCurrency(decimalToNumber(entry.dayTotal))}</strong>
                      </header>
                      <div className="paid-daily-meta">
                        <span>Diária: {formatCurrency(decimalToNumber(entry.dailyValue))}</span>
                        <span>H.E.: {decimalToNumber(entry.overtimeHours)}h</span>
                        <span>Total H.E.: {formatCurrency(decimalToNumber(entry.overtimeTotal))}</span>
                      </div>
                      {entry.closureId ? (
                        <Link className="button secondary compact" href={`/diarias/fechamento/${entry.closureId}`}>
                          <Download size={16} /> Abrir recibo
                        </Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="daily-table">
            <div className="daily-row header"><span>Data</span><span>Funcionário</span><span>Função</span><span>Diária</span><span>H.E.</span><span>Valor H.E.</span><span>Total</span><span>Status</span><span>Recibo</span></div>
            {entries.map((entry) => (
              <div className="daily-row" key={entry.id}>
                <span>{formatDate(entry.date)}</span>
                <span>{entry.employeeName}</span>
                <span>{entry.role}</span>
                <span>{formatCurrency(decimalToNumber(entry.dailyValue))}</span>
                <span>{decimalToNumber(entry.overtimeHours)}h</span>
                <span>{formatCurrency(decimalToNumber(entry.overtimeRate))}</span>
                <strong>{formatCurrency(decimalToNumber(entry.dayTotal))}</strong>
                <span className={entry.status === "PAGO" ? "tag income" : "tag pending"}>{entry.status}</span>
                {isAdmin && entry.status === "PENDENTE" ? (
                  <div className="row-actions">
                    <Link className="icon-button" href={`/diarias/${entry.id}/editar`} aria-label="Editar diária"><Pencil size={16} /></Link>
                    <form action={deleteDailyEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button className="icon-danger" type="submit" aria-label="Deletar diária"><Trash2 size={16} /></button>
                    </form>
                  </div>
                ) : entry.status === "PAGO" && entry.closureId ? (
                  <Link className="button secondary compact" href={`/diarias/fechamento/${entry.closureId}`}>
                    <Download size={16} /> Abrir
                  </Link>
                ) : <span />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Resumo individual</h2>
          <span>{pending.length} funcionários</span>
        </div>
        <div className="summary-grid">
          {pending.map((item) => (
            <article className="summary-card" key={`${item.employeeName}-${item.role}`}>
              <h3>{item.employeeName}</h3>
              <span>{item.role}</span>
              <div><small>Dias</small><strong>{item._count.id}</strong></div>
              <div><small>Diárias</small><strong>{formatCurrency(decimalToNumber(item._sum.dailyValue ?? 0))}</strong></div>
              <div><small>Horas extras</small><strong>{formatCurrency(decimalToNumber(item._sum.overtimeTotal ?? 0))}</strong></div>
              <div><small>Total</small><strong>{formatCurrency(decimalToNumber(item._sum.dayTotal ?? 0))}</strong></div>
              {isAdmin ? (
                <Link className="button" href={`/diarias/pagamento/${encodeURIComponent(item.employeeName)}`}>
                  <Eye size={18} /> Ver pagamento
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}






