import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { ensurePayrollSchema } from "@/lib/payroll-schema";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FechamentoPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  await ensurePayrollSchema(prisma);

  const closure = await prisma.payrollClosure.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { date: "asc" } },
      advances: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!closure) notFound();

  const grossTotal = closure.totalDaily.add(closure.totalOvertime);

  return (
    <AppShell active="diarias" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Recibo"
        title={`Recibo ${closure.receiptNumber}`}
        description={`${closure.employeeName} - ${formatDate(closure.periodStart)} a ${formatDate(closure.periodEnd)}`}
        actions={
          <>
            <Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>
            <a className="button" href={`/api/diarias/fechamento/${closure.id}/pdf`}><Download size={18} /> Baixar PDF</a>
          </>
        }
      />

      <section className="pdf-preview-wrap">
        <div className="pdf-page">
          <header className="pdf-header">
            <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={86} height={86} />
            <div>
              <strong>DORIGHETTO PERFURAÇÃO</strong>
              <span>Recibo de pagamento de diárias</span>
            </div>
            <small>{closure.receiptNumber}</small>
          </header>

          <div className="pdf-title">
            <h2>RECIBO DE PAGAMENTO</h2>
            <p>Declaro que recebi da empresa Dorighetto Perfuração o valor líquido referente às diárias trabalhadas no período informado abaixo.</p>
          </div>

          <div className="pdf-info-grid">
            <div><span>Funcionário</span><strong>{closure.employeeName}</strong></div>
            <div><span>Função</span><strong>{closure.role}</strong></div>
            <div><span>Período</span><strong>{formatDate(closure.periodStart)} a {formatDate(closure.periodEnd)}</strong></div>
            <div><span>Data do pagamento</span><strong>{formatDate(closure.paidAt)}</strong></div>
            <div><span>Dias trabalhados</span><strong>{closure.daysWorked}</strong></div>
            <div><span>Total líquido recebido</span><strong>{formatCurrency(decimalToNumber(closure.totalPaid))}</strong></div>
          </div>

          <div className="pdf-table">
            <div className="pdf-row header"><span>Data</span><span>Diária</span><span>H. extra</span><span>Valor H.E.</span><span>Total H.E.</span><span>Total dia</span></div>
            {closure.entries.map((entry) => (
              <div className="pdf-row" key={entry.id}>
                <span>{formatDate(entry.date)}</span>
                <span>{formatCurrency(decimalToNumber(entry.dailyValue))}</span>
                <span>{decimalToNumber(entry.overtimeHours)}h</span>
                <span>{formatCurrency(decimalToNumber(entry.overtimeRate))}</span>
                <span>{formatCurrency(decimalToNumber(entry.overtimeTotal))}</span>
                <strong>{formatCurrency(decimalToNumber(entry.dayTotal))}</strong>
              </div>
            ))}
          </div>

          {closure.advances.length > 0 ? (
            <div className="pdf-advance-box">
              <strong>Vales descontados</strong>
              {closure.advances.map((advance) => (
                <div key={advance.id}>
                  <span>{advance.notes}</span>
                  <strong>{formatCurrency(decimalToNumber(advance.amount))}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="pdf-total-box">
            <div><span>Total de diárias</span><strong>{formatCurrency(decimalToNumber(closure.totalDaily))}</strong></div>
            <div><span>Total horas extras</span><strong>{formatCurrency(decimalToNumber(closure.totalOvertime))}</strong></div>
            <div><span>Total bruto</span><strong>{formatCurrency(decimalToNumber(grossTotal))}</strong></div>
            <div><span>Vales descontados</span><strong>- {formatCurrency(decimalToNumber(closure.totalAdvance))}</strong></div>
            <div className="grand-total"><span>Total líquido recebido</span><strong>{formatCurrency(decimalToNumber(closure.totalPaid))}</strong></div>
          </div>

          <p className="pdf-declaration">
            Eu, {closure.employeeName}, declaro para os devidos fins que recebi o valor líquido acima descrito, referente aos dias trabalhados no período informado, já descontados os vales listados neste recibo quando houver.
          </p>

          <div className="signature-grid">
            <div>
              <span>Local e data</span>
              <strong>________________________________________</strong>
            </div>
            <div>
              <span>Assinatura do funcionário</span>
              <strong>________________________________________</strong>
            </div>
            <div>
              <span>Assinatura do responsável</span>
              <strong>________________________________________</strong>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
