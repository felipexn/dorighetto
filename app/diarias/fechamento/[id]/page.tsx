import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FechamentoPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const closure = await prisma.payrollClosure.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: "asc" } } }
  });

  if (!closure) notFound();

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
            <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuracao" width={86} height={86} />
            <div>
              <strong>DORIGHETTO PERFURACAO</strong>
              <span>Recibo de pagamento de diarias</span>
            </div>
            <small>{closure.receiptNumber}</small>
          </header>

          <div className="pdf-title">
            <h2>RECIBO DE PAGAMENTO</h2>
            <p>Declaro que recebi da empresa Dorighetto Perfuracao o valor referente as diarias trabalhadas no periodo informado abaixo.</p>
          </div>

          <div className="pdf-info-grid">
            <div><span>Funcionario</span><strong>{closure.employeeName}</strong></div>
            <div><span>Funcao</span><strong>{closure.role}</strong></div>
            <div><span>Periodo</span><strong>{formatDate(closure.periodStart)} a {formatDate(closure.periodEnd)}</strong></div>
            <div><span>Data do pagamento</span><strong>{formatDate(closure.paidAt)}</strong></div>
            <div><span>Dias trabalhados</span><strong>{closure.daysWorked}</strong></div>
            <div><span>Total recebido</span><strong>{formatCurrency(decimalToNumber(closure.totalPaid))}</strong></div>
          </div>

          <div className="pdf-table">
            <div className="pdf-row header"><span>Data</span><span>Diaria</span><span>H. extra</span><span>Valor H.E.</span><span>Total H.E.</span><span>Total dia</span></div>
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

          <div className="pdf-total-box">
            <div><span>Total de diarias</span><strong>{formatCurrency(decimalToNumber(closure.totalDaily))}</strong></div>
            <div><span>Total horas extras</span><strong>{formatCurrency(decimalToNumber(closure.totalOvertime))}</strong></div>
            <div className="grand-total"><span>Total geral recebido</span><strong>{formatCurrency(decimalToNumber(closure.totalPaid))}</strong></div>
          </div>

          <p className="pdf-declaration">
            Eu, {closure.employeeName}, declaro para os devidos fins que recebi o valor total acima descrito, referente aos dias trabalhados no periodo informado.
          </p>

          <div className="signature-grid">
            <div>
              <span>Local e data</span>
              <strong>________________________________________</strong>
            </div>
            <div>
              <span>Assinatura do funcionario</span>
              <strong>________________________________________</strong>
            </div>
            <div>
              <span>Assinatura do responsavel</span>
              <strong>________________________________________</strong>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
