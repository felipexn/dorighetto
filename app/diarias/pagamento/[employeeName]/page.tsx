import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ConfirmPaymentForm } from "@/components/confirm-payment-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ employeeName: string }>;
};

export default async function PagamentoDiariaPage({ params }: Props) {
  const session = await requireSession();
  const { employeeName: rawEmployeeName } = await params;
  const employeeName = decodeURIComponent(rawEmployeeName);
  const isAdmin = session.role === "ADMIN";

  const entries = await prisma.dailyEntry.findMany({
    where: {
      employeeName,
      status: "PENDENTE"
    },
    orderBy: { date: "asc" }
  });

  if (entries.length === 0) notFound();

  const periodStart = entries[0].date;
  const periodEnd = entries[entries.length - 1].date;
  const totalDaily = entries.reduce((total, entry) => total.add(entry.dailyValue), new Prisma.Decimal(0));
  const totalOvertime = entries.reduce((total, entry) => total.add(entry.overtimeTotal), new Prisma.Decimal(0));
  const totalPaid = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));
  const totalPaidFormatted = formatCurrency(decimalToNumber(totalPaid));

  return (
    <AppShell active="diarias" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Prévia"
        title="Prévia de pagamento"
        description={`${employeeName} - ${formatDate(periodStart)} a ${formatDate(periodEnd)}`}
        actions={
          <>
            <Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>
            {isAdmin ? <ConfirmPaymentForm employeeName={employeeName} total={totalPaidFormatted} /> : null}
          </>
        }
      />

      <section className="pdf-preview-wrap">
        <div className="pdf-page">
          <header className="pdf-header">
            <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={86} height={86} />
            <div>
              <strong>DORIGHETTO PERFURAÇÃO</strong>
              <span>Prévia de recibo de pagamento de diárias</span>
            </div>
            <small>PENDENTE</small>
          </header>

          <div className="pdf-title">
            <h2>PREVIA DE PAGAMENTO</h2>
            <p>Confira os dias, valores e total antes de confirmar. O status so muda para pago apos a confirmação.</p>
          </div>

          <div className="pdf-info-grid">
            <div><span>Funcionário</span><strong>{employeeName}</strong></div>
            <div><span>Função</span><strong>{entries[0].role}</strong></div>
            <div><span>Período</span><strong>{formatDate(periodStart)} a {formatDate(periodEnd)}</strong></div>
            <div><span>Status</span><strong>PENDENTE</strong></div>
            <div><span>Dias trabalhados</span><strong>{entries.length}</strong></div>
            <div><span>Total a pagar</span><strong>{totalPaidFormatted}</strong></div>
          </div>

          <div className="pdf-table">
            <div className="pdf-row header"><span>Data</span><span>Diária</span><span>H. extra</span><span>Valor H.E.</span><span>Total H.E.</span><span>Total dia</span></div>
            {entries.map((entry) => (
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
            <div><span>Total de diárias</span><strong>{formatCurrency(decimalToNumber(totalDaily))}</strong></div>
            <div><span>Total horas extras</span><strong>{formatCurrency(decimalToNumber(totalOvertime))}</strong></div>
            <div className="grand-total"><span>Total geral a pagar</span><strong>{totalPaidFormatted}</strong></div>
          </div>

          <p className="pdf-declaration">
            Esta prévia ainda não confirma pagamento. Após conferir, use o botão de confirmação para gerar o recibo e marcar as diárias como pagas.
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





