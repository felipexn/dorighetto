import Link from "next/link";
import { ArrowLeft, Download, Undo2 } from "lucide-react";
import { reopenPayrollClosureAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

export default async function HistoricoDiariasPage() {
  const session = await requireModule("diarias");

  const closures = await prisma.payrollClosure.findMany({
    orderBy: { paidAt: "desc" }
  });

  return (
    <AppShell active="diarias" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Histórico"
        title="Pagamentos realizados"
        actions={<Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>}
      />

      <section className="panel table-panel">
        <div className={`daily-table closures${session.permissions.canWriteDaily ? " can-reopen" : ""}`}>
          <div className="daily-row header"><span>Pagamento</span><span>Funcionário</span><span>Período</span><span>Dias</span><span>Total</span><span>Recibo</span><span>PDF</span>{session.permissions.canWriteDaily ? <span>Ação</span> : null}</div>
          {closures.map((closure) => (
            <div className="daily-row" key={closure.id}>
              <span data-label="Pagamento">{formatDate(closure.paidAt)}</span>
              <span data-label="Funcionário">{closure.employeeName}</span>
              <span data-label="Período">{formatDate(closure.periodStart)} a {formatDate(closure.periodEnd)}</span>
              <span data-label="Dias">{closure.daysWorked}</span>
              <strong data-label="Total">{formatCurrency(decimalToNumber(closure.totalPaid))}</strong>
              <Link className="button secondary compact" data-label="Recibo" href={`/diarias/fechamento/${closure.id}`}><Download size={16} /> Abrir</Link>
              <a className="button compact" data-label="PDF" href={`/api/diarias/fechamento/${closure.id}/pdf`}><Download size={16} /> Baixar</a>
{session.permissions.canWriteDaily ? (
              <div className="row-actions" data-label="Ação">
                <form action={reopenPayrollClosureAction}>
                  <input type="hidden" name="closureId" value={closure.id} />
                  <ConfirmSubmitButton
                    className="danger-button inline-danger compact"
                    message={`Voltar o pagamento de ${closure.employeeName}? As diárias, os vales e os acréscimos deste fechamento retornarão para pendente.`}
                  >
                    <Undo2 size={16} /> Voltar
                  </ConfirmSubmitButton>
                </form>
              </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}




