import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

export default async function HistoricoDiariasPage() {
  const session = await requireSession();
  const closures = await prisma.payrollClosure.findMany({
    orderBy: { paidAt: "desc" }
  });

  return (
    <AppShell active="diarias" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Historico"
        title="Pagamentos realizados"
        actions={<Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>}
      />

      <section className="panel table-panel">
        <div className="daily-table closures">
          <div className="daily-row header"><span>Pagamento</span><span>Funcionario</span><span>Periodo</span><span>Dias</span><span>Total</span><span>Recibo</span></div>
          {closures.map((closure) => (
            <div className="daily-row" key={closure.id}>
              <span>{formatDate(closure.paidAt)}</span>
              <span>{closure.employeeName}</span>
              <span>{formatDate(closure.periodStart)} a {formatDate(closure.periodEnd)}</span>
              <span>{closure.daysWorked}</span>
              <strong>{formatCurrency(decimalToNumber(closure.totalPaid))}</strong>
              <Link className="button secondary compact" href={`/diarias/fechamento/${closure.id}`}><Download size={16} /> Abrir</Link>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
