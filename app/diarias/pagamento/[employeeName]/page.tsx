import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { addPayrollAdvanceAction, deletePayrollAdvanceAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmPaymentForm } from "@/components/confirm-payment-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { ensurePayrollSchema } from "@/lib/payroll-schema";

type Props = {
  params: Promise<{ employeeName: string }>;
};

export default async function PagamentoDiariaPage({ params }: Props) {
  const session = await requireSession();
  const { employeeName: rawEmployeeName } = await params;
  const employeeName = decodeURIComponent(rawEmployeeName);
  const isAdmin = session.role === "ADMIN";

  await ensurePayrollSchema(prisma);

  const [entries, advances] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        employeeName,
        status: "PENDENTE"
      },
      orderBy: { date: "asc" }
    }),
    prisma.payrollAdvance.findMany({
      where: {
        employeeName,
        status: "PENDENTE"
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  if (entries.length === 0) notFound();

  const periodStart = entries[0].date;
  const periodEnd = entries[entries.length - 1].date;
  const totalDaily = entries.reduce((total, entry) => total.add(entry.dailyValue), new Prisma.Decimal(0));
  const totalOvertime = entries.reduce((total, entry) => total.add(entry.overtimeTotal), new Prisma.Decimal(0));
  const totalGross = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));
  const totalAdvance = advances.reduce((total, advance) => total.add(advance.amount), new Prisma.Decimal(0));
  const totalNet = totalGross.sub(totalAdvance);
  const totalNetFormatted = formatCurrency(decimalToNumber(totalNet));

  return (
    <AppShell active="diarias" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Prévia"
        title="Prévia de pagamento"
        description={`${employeeName} - ${formatDate(periodStart)} a ${formatDate(periodEnd)}`}
        actions={
          <>
            <Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>
            {isAdmin ? <ConfirmPaymentForm employeeName={employeeName} total={totalNetFormatted} /> : null}
          </>
        }
      />

      {isAdmin ? (
        <section className="panel advance-panel">
          <div>
            <span className="eyebrow">Vales pendentes</span>
            <h2>Adicionar vale antes do pagamento</h2>
            <p>O vale fica salvo para este funcionário. Se o pagamento for confirmado, ele será descontado no recibo.</p>
          </div>

          <form className="advance-form" action={addPayrollAdvanceAction}>
            <input type="hidden" name="employeeName" value={employeeName} />
            <label>
              Valor do vale
              <input name="amount" placeholder="0,00" required />
            </label>
            <label className="wide-field">
              Observação / motivo
              <input name="notes" placeholder="Ex: vale transporte, adiantamento, compra..." required />
            </label>
            <button type="submit">Salvar vale</button>
          </form>

          <div className="advance-list">
            {advances.length === 0 ? (
              <p className="muted-text">Nenhum vale pendente para descontar neste pagamento.</p>
            ) : advances.map((advance) => (
              <article className="advance-item" key={advance.id}>
                <div>
                  <strong>{formatCurrency(decimalToNumber(advance.amount))}</strong>
                  <span>{advance.notes}</span>
                  <small>Lançado em {formatDate(advance.createdAt)}</small>
                </div>
                <form action={deletePayrollAdvanceAction}>
                  <input type="hidden" name="id" value={advance.id} />
                  <input type="hidden" name="employeeName" value={employeeName} />
                  <button className="icon-danger" type="submit" aria-label="Remover vale pendente">
                    <Trash2 size={16} />
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
            <h2>PRÉVIA DE PAGAMENTO</h2>
            <p>Confira os dias, valores, vales e total líquido antes de confirmar. O status só muda para pago após a confirmação.</p>
          </div>

          <div className="pdf-info-grid">
            <div><span>Funcionário</span><strong>{employeeName}</strong></div>
            <div><span>Função</span><strong>{entries[0].role}</strong></div>
            <div><span>Período</span><strong>{formatDate(periodStart)} a {formatDate(periodEnd)}</strong></div>
            <div><span>Status</span><strong>PENDENTE</strong></div>
            <div><span>Dias trabalhados</span><strong>{entries.length}</strong></div>
            <div><span>Total líquido a pagar</span><strong>{totalNetFormatted}</strong></div>
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

          {advances.length > 0 ? (
            <div className="pdf-advance-box">
              <strong>Vales a descontar</strong>
              {advances.map((advance) => (
                <div key={advance.id}>
                  <span>{advance.notes}</span>
                  <strong>{formatCurrency(decimalToNumber(advance.amount))}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="pdf-total-box">
            <div><span>Total de diárias</span><strong>{formatCurrency(decimalToNumber(totalDaily))}</strong></div>
            <div><span>Total horas extras</span><strong>{formatCurrency(decimalToNumber(totalOvertime))}</strong></div>
            <div><span>Vales pendentes</span><strong>- {formatCurrency(decimalToNumber(totalAdvance))}</strong></div>
            <div className="grand-total"><span>Total líquido a pagar</span><strong>{totalNetFormatted}</strong></div>
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
