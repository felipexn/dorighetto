import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, CircleMinus, CirclePlus, Trash2, WalletCards } from "lucide-react";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { addPayrollAdditionAction, addPayrollAdvanceAction, deletePayrollAdditionAction, deletePayrollAdvanceAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ConfirmPaymentForm } from "@/components/confirm-payment-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ employeeName: string }>;
};

export default async function PagamentoDiariaPage({ params }: Props) {
  const session = await requireModule("diarias");
  const { employeeName: rawEmployeeName } = await params;
  const employeeName = decodeURIComponent(rawEmployeeName);
  const canWrite = session.permissions.canWriteDaily;

  const [entries, advances, additions] = await Promise.all([
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
    }),
    prisma.payrollAddition.findMany({
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
  const totalOvertimeHours = entries.reduce((total, entry) => total + decimalToNumber(entry.overtimeHours), 0);
  const totalGross = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));
  const totalAdvance = advances.reduce((total, advance) => total.add(advance.amount), new Prisma.Decimal(0));
  const totalAddition = additions.reduce((total, addition) => total.add(addition.amount), new Prisma.Decimal(0));
  const totalNet = totalGross.add(totalAddition).sub(totalAdvance);
  const totalNetFormatted = formatCurrency(decimalToNumber(totalNet));
  const employeeType = entries[0].employeeType;
  const salaryReference = entries.find((entry) => entry.monthlySalary)?.monthlySalary ?? null;

  return (
    <AppShell active="diarias" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Prévia"
        title="Prévia de pagamento"
        description={`${employeeName} - ${formatDate(periodStart)} a ${formatDate(periodEnd)}`}
        actions={
          <>
            <Link className="button secondary" href="/diarias"><ArrowLeft size={18} /> Voltar</Link>
            {canWrite ? <ConfirmPaymentForm employeeName={employeeName} total={totalNetFormatted} /> : null}
          </>
        }
      />

      {canWrite ? (
        <details className="panel advance-panel payment-adjustments" open={advances.length > 0 || additions.length > 0}>
          <summary className="payment-adjustment-summary">
            <span className="form-section-title">
              <span className="section-icon large"><WalletCards size={22} /></span>
              <span>
                <strong>Ajustes do pagamento</strong>
                <small>Vales e acréscimos antes de pagar</small>
              </span>
            </span>
            <span className="adjustment-summary-values">
              {decimalToNumber(totalAddition) > 0 ? <strong className="positive">+ {formatCurrency(decimalToNumber(totalAddition))}</strong> : null}
              {decimalToNumber(totalAdvance) > 0 ? <strong className="negative">- {formatCurrency(decimalToNumber(totalAdvance))}</strong> : null}
              <ChevronDown size={20} />
            </span>
          </summary>

          <div className="adjustment-content">
            <div className="adjustment-form-grid">
              <form className="adjustment-card addition" action={addPayrollAdditionAction}>
                <input type="hidden" name="employeeName" value={employeeName} />
                <div className="adjustment-card-title"><CirclePlus size={20} /><div><strong>Acréscimo</strong><small>Valor que será somado</small></div></div>
                <label>Valor<input name="amount" inputMode="decimal" placeholder="R$ 0,00" required /></label>
                <label>Motivo<input name="notes" placeholder="Ex: produção ou premiação" required /></label>
                <button type="submit"><CirclePlus size={17} /> Adicionar acréscimo</button>
              </form>

              <form className="adjustment-card discount" action={addPayrollAdvanceAction}>
                <input type="hidden" name="employeeName" value={employeeName} />
                <div className="adjustment-card-title"><CircleMinus size={20} /><div><strong>Vale ou desconto</strong><small>Valor que será descontado</small></div></div>
                <label>Valor<input name="amount" inputMode="decimal" placeholder="R$ 0,00" required /></label>
                <label>Motivo<input name="notes" placeholder="Ex: transporte ou adiantamento" required /></label>
                <button type="submit"><CircleMinus size={17} /> Adicionar vale</button>
              </form>
            </div>

            <div className="adjustment-list-grid">
              <section>
                <h3>Acréscimos pendentes</h3>
                {additions.length === 0 ? <p className="adjustment-empty">Nenhum acréscimo.</p> : additions.map((addition) => (
                  <article className="advance-item addition" key={addition.id}>
                    <div>
                      <strong>+ {formatCurrency(decimalToNumber(addition.amount))}</strong>
                      <span>{addition.notes}</span>
                      <small>{formatDate(addition.createdAt)}</small>
                    </div>
                    <form action={deletePayrollAdditionAction}>
                      <input type="hidden" name="id" value={addition.id} />
                      <input type="hidden" name="employeeName" value={employeeName} />
                      <ConfirmSubmitButton className="icon-danger" aria-label="Remover acréscimo pendente" message="Remover este acréscimo pendente?">
                        <Trash2 size={16} />
                      </ConfirmSubmitButton>
                    </form>
                  </article>
                ))}
              </section>

              <section>
                <h3>Vales pendentes</h3>
                {advances.length === 0 ? <p className="adjustment-empty">Nenhum vale.</p> : advances.map((advance) => (
                  <article className="advance-item discount" key={advance.id}>
                    <div>
                      <strong>- {formatCurrency(decimalToNumber(advance.amount))}</strong>
                      <span>{advance.notes}</span>
                      <small>{formatDate(advance.createdAt)}</small>
                    </div>
                    <form action={deletePayrollAdvanceAction}>
                      <input type="hidden" name="id" value={advance.id} />
                      <input type="hidden" name="employeeName" value={employeeName} />
                      <ConfirmSubmitButton className="icon-danger" aria-label="Remover vale pendente" message="Remover este vale pendente?">
                        <Trash2 size={16} />
                      </ConfirmSubmitButton>
                    </form>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </details>
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

          {additions.length > 0 ? (
            <div className="pdf-advance-box">
              <strong>Acréscimos a somar</strong>
              {additions.map((addition) => (
                <div key={addition.id}>
                  <span>{addition.notes}</span>
                  <strong>+ {formatCurrency(decimalToNumber(addition.amount))}</strong>
                </div>
              ))}
            </div>
          ) : null}

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
            <div><span>Quantidade H.E.</span><strong>{totalOvertimeHours.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}h</strong></div>
            <div><span>Total horas extras</span><strong>{formatCurrency(decimalToNumber(totalOvertime))}</strong></div>
            <div><span>Acréscimos pendentes</span><strong>+ {formatCurrency(decimalToNumber(totalAddition))}</strong></div>
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
