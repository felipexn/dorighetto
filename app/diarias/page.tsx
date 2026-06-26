import Link from "next/link";
import { ChevronDown, Download, Eye, FileClock, Save, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PaymentEntryForm } from "@/components/payment-entry-form";
import { PaymentsTable } from "@/components/payments-table";
import { PageHeader } from "@/components/ui";
import { createPayrollEmployeeAction, deleteDailyEntryAction, deletePayrollEmployeeAction, updatePayrollEmployeeAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { toDateInput } from "@/lib/diarias";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { ensurePayrollSchema } from "@/lib/payroll-schema";

type SearchParams = Promise<{
  funcionario?: string;
  funcao?: string;
  status?: string;
}>;

export default async function DiariasPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireModule("diarias");
  const params = await searchParams;
  const canWrite = session.permissions.canWriteDaily;
  await ensurePayrollSchema(prisma);

  const [entries, employees, dailyNames] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        employeeName: params.funcionario || undefined,
        role: params.funcao === "AJUDANTE" || params.funcao === "OPERADOR" ? params.funcao : undefined,
        status: params.status === "PAGO" || params.status === "PENDENTE" ? params.status : "PENDENTE"
      },
      include: { closure: true, employee: true },
      orderBy: [{ date: "desc" }, { employeeName: "asc" }]
    }),
    prisma.payrollEmployee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    }),
    prisma.dailyEntry.findMany({
      distinct: ["employeeName"],
      select: { employeeName: true },
      orderBy: { employeeName: "asc" }
    })
  ]);

  const employeeOptions = Array.from(new Set([
    ...employees.map((employee) => employee.name),
    ...dailyNames.map((employee) => employee.employeeName)
  ])).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const activeFichados = employees.filter((employee) => employee.type === "FICHADO");
  const fichados = activeFichados.map((employee) => ({
    name: employee.name,
    role: employee.role,
    monthlySalary: employee.monthlySalary ? decimalToNumber(employee.monthlySalary) : null,
    defaultOvertimeRate: employee.defaultOvertimeRate ? decimalToNumber(employee.defaultOvertimeRate) : null
  }));

  const tableEntries = entries.map((entry) => ({
    id: entry.id,
    date: formatDate(entry.date),
    employeeName: entry.employeeName,
    role: entry.role,
    employeeType: entry.employeeType,
    dailyValue: formatCurrency(decimalToNumber(entry.dailyValue)),
    overtimeHours: decimalToNumber(entry.overtimeHours).toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
    overtimeRate: formatCurrency(decimalToNumber(entry.overtimeRate)),
    monthlySalary: entry.monthlySalary ? formatCurrency(decimalToNumber(entry.monthlySalary)) : "-",
    dayTotal: formatCurrency(decimalToNumber(entry.dayTotal)),
    status: entry.status,
    closureId: entry.closureId
  }));

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
    by: ["employeeName", "role", "employeeType"],
    where: { status: "PENDENTE" },
    _count: { id: true },
    _sum: { dailyValue: true, overtimeTotal: true, dayTotal: true },
    orderBy: { employeeName: "asc" }
  });

  const pendingKeys = new Set(pending.map((item) => `${item.employeeName}-${item.role}-${item.employeeType}`));
  const pendingDiaristas = pending.filter((item) => item.employeeType === "DIARISTA");
  const pendingFichados = pending.filter((item) => item.employeeType === "FICHADO");
  const emptyFichados = activeFichados.filter((employee) => !pendingKeys.has(`${employee.name}-${employee.role}-FICHADO`));
  const summaryTotal = pendingDiaristas.length + pendingFichados.length + emptyFichados.length;

  return (
    <AppShell active="diarias" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Pagamentos"
        title="Pagamentos pendentes"
        description="Lance diaristas como antes, com diária e horas extras. Funcionários fichados ficam cadastrados e recebem apenas horas extras."
        actions={<Link className="button secondary" href="/diarias/historico"><FileClock size={18} /> Histórico</Link>}
      />

      {canWrite ? (
        <section className="payment-entry-grid">
          <PaymentEntryForm today={toDateInput(new Date())} employeeNames={employeeOptions} fichados={fichados} />

          <details className="panel employee-register-panel">
            <summary>
              <div>
                <span className="eyebrow">Cadastro de fichado</span>
                <strong>Novo funcionário fichado</strong>
                <small>Abra somente para cadastrar funcionário fichado. Salário mensal é opcional.</small>
              </div>
              <UserPlus size={20} />
            </summary>
            <form className="daily-form employee-register-form" action={createPayrollEmployeeAction}>
              <label>Nome<input name="name" placeholder="Nome do funcionário" required /></label>
              <label>Função<select name="role" defaultValue="AJUDANTE"><option>AJUDANTE</option><option>OPERADOR</option></select></label>
              <label>Salário mensal<input name="monthlySalary" placeholder="Opcional" /></label>
              <label>Hora extra padrão<input name="defaultOvertimeRate" placeholder="Opcional" /></label>
              <button type="submit"><UserPlus size={18} /> Salvar fichado</button>
            </form>
          </details>
        </section>
      ) : null}

      {canWrite ? (
        <details className="panel fichados-admin-panel section-gap">
          <summary>
            <div>
              <span className="eyebrow">Administração</span>
              <strong>Administrar fichados</strong>
              <small>{activeFichados.length} funcionários fichados cadastrados</small>
            </div>
            <ChevronDown size={20} />
          </summary>
          <div className="fichados-admin-list">
            {activeFichados.length === 0 ? <p className="muted-text">Nenhum fichado cadastrado.</p> : null}
            {activeFichados.map((employee) => (
              <article className="fichado-admin-card" key={employee.id}>
                <form className="daily-form employee-register-form" action={updatePayrollEmployeeAction}>
                  <input type="hidden" name="id" value={employee.id} />
                  <label>Nome<input name="name" defaultValue={employee.name} required /></label>
                  <label>Função<select name="role" defaultValue={employee.role}><option>AJUDANTE</option><option>OPERADOR</option></select></label>
                  <label>Salário mensal<input name="monthlySalary" defaultValue={employee.monthlySalary ? decimalToNumber(employee.monthlySalary) : ""} placeholder="Opcional" /></label>
                  <label>Hora extra padrão<input name="defaultOvertimeRate" defaultValue={employee.defaultOvertimeRate ? decimalToNumber(employee.defaultOvertimeRate) : ""} placeholder="Opcional" /></label>
                  <button type="submit"><Save size={18} /> Salvar</button>
                </form>
                <form action={deletePayrollEmployeeAction}>
                  <input type="hidden" name="id" value={employee.id} />
                  <button className="danger-button" type="submit"><Trash2 size={16} /> Remover da lista</button>
                </form>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      <form className="panel filters section-gap">
        <label>Funcionário
          <select name="funcionario" defaultValue={params.funcionario ?? ""}>
            <option value="">Todos</option>
            {employeeOptions.map((employeeName) => <option key={employeeName}>{employeeName}</option>)}
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
          <h2>{isPaidFilter ? "Pagamentos pagos" : "Planilha geral"}</h2>
          <span>{entries.length} registros</span>
        </div>

        {isPaidFilter ? (
          <div className="paid-daily-groups">
            {paidGroups.length === 0 ? <p className="muted-text">Nenhum pagamento pago encontrado neste filtro.</p> : null}
            {paidGroups.map((group) => (
              <details className="paid-daily-group" key={group.dateKey}>
                <summary>
                  <div>
                    <strong>{group.label}</strong>
                    <span>{group.entries.length} pagamentos pagos | {formatCurrency(group.total)}</span>
                  </div>
                  <ChevronDown size={18} />
                </summary>

                <div className="paid-daily-list">
                  {group.entries.map((entry) => (
                    <article className="paid-daily-card" key={entry.id}>
                      <header>
                        <div>
                          <strong>{entry.employeeName}</strong>
                          <span>{entry.role} | {entry.employeeType} | Trabalhado em {formatDate(entry.date)}</span>
                        </div>
                        <strong>{formatCurrency(decimalToNumber(entry.dayTotal))}</strong>
                      </header>
                      <div className="paid-daily-meta">
                        {entry.employeeType === "DIARISTA" ? <span>Diária: {formatCurrency(decimalToNumber(entry.dailyValue))}</span> : null}
                        <span>H.E.: {decimalToNumber(entry.overtimeHours)}h</span>
                        <span>Total H.E.: {formatCurrency(decimalToNumber(entry.overtimeTotal))}</span>
                        {entry.employeeType === "FICHADO" && entry.monthlySalary ? <span>Salário ref.: {formatCurrency(decimalToNumber(entry.monthlySalary))}</span> : null}
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
          <PaymentsTable entries={tableEntries} canWrite={canWrite} />
        )}
      </section>

      <section className="panel section-gap">
        <div className="table-head">
          <h2>Resumo individual</h2>
          <span>{summaryTotal} funcionários</span>
        </div>

        <div className="summary-section-head">
          <h3>Diaristas</h3>
          <span>{pendingDiaristas.length} com pendências</span>
        </div>
        <div className="summary-grid">
          {pendingDiaristas.length === 0 ? <p className="muted-text">Nenhum diarista com pagamento pendente.</p> : null}
          {pendingDiaristas.map((item) => (
            <article className="summary-card" key={`${item.employeeName}-${item.role}-${item.employeeType}`}>
              <h3>{item.employeeName}</h3>
              <span>{item.role} | {item.employeeType}</span>
              <div><small>Lançamentos</small><strong>{item._count.id}</strong></div>
              <div><small>Diárias</small><strong>{formatCurrency(decimalToNumber(item._sum.dailyValue ?? 0))}</strong></div>
              <div><small>Horas extras</small><strong>{formatCurrency(decimalToNumber(item._sum.overtimeTotal ?? 0))}</strong></div>
              <div><small>Total</small><strong>{formatCurrency(decimalToNumber(item._sum.dayTotal ?? 0))}</strong></div>
              {canWrite ? (
                <Link className="button" href={`/diarias/pagamento/${encodeURIComponent(item.employeeName)}`}>
                  <Eye size={18} /> Ver pagamento
                </Link>
              ) : null}
            </article>
          ))}
        </div>

        <div className="summary-section-head fichado-summary-head">
          <h3>Fichados</h3>
          <span>{pendingFichados.length + emptyFichados.length} cadastrados</span>
        </div>
        <div className="summary-grid">
          {pendingFichados.map((item) => (
            <article className="summary-card" key={`${item.employeeName}-${item.role}-${item.employeeType}`}>
              <h3>{item.employeeName}</h3>
              <span>{item.role} | {item.employeeType}</span>
              <div><small>Lançamentos</small><strong>{item._count.id}</strong></div>
              <div><small>Diárias</small><strong>{formatCurrency(decimalToNumber(item._sum.dailyValue ?? 0))}</strong></div>
              <div><small>Horas extras</small><strong>{formatCurrency(decimalToNumber(item._sum.overtimeTotal ?? 0))}</strong></div>
              <div><small>Total</small><strong>{formatCurrency(decimalToNumber(item._sum.dayTotal ?? 0))}</strong></div>
              {canWrite ? (
                <Link className="button" href={`/diarias/pagamento/${encodeURIComponent(item.employeeName)}`}>
                  <Eye size={18} /> Ver pagamento
                </Link>
              ) : null}
            </article>
          ))}
          {emptyFichados.map((employee) => (
            <article className="summary-card muted-summary-card" key={`${employee.name}-${employee.role}-FICHADO`}>
              <h3>{employee.name}</h3>
              <span>{employee.role} | FICHADO</span>
              <div><small>Lançamentos</small><strong>0</strong></div>
              <div><small>Salário ref.</small><strong>{employee.monthlySalary ? formatCurrency(decimalToNumber(employee.monthlySalary)) : "-"}</strong></div>
              <div><small>Horas extras</small><strong>{formatCurrency(0)}</strong></div>
              <div><small>Total</small><strong>{formatCurrency(0)}</strong></div>
              <small className="muted-text">Sem horas extras pendentes.</small>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
