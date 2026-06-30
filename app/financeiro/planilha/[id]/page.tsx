import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createEntryAction, deleteEntryAction, deleteSheetAction, updateSheetAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FinancialPrivacyToggle } from "@/components/financial-privacy-toggle";
import { PrivateValue } from "@/components/private-value";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { toDateInput } from "@/lib/diarias";

type Params = Promise<{ id: string }>;

export default async function PlanilhaFinanceiraPage({ params }: { params: Params }) {
  const session = await requireModule("financeiro");
  const { id } = await params;
  const canWrite = session.permissions.canWriteFinance;

  const sheet = await prisma.financialSheet.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!sheet) notFound();

  const entradas = sheet.entries
    .filter((entry) => entry.type === "ENTRADA")
    .reduce((total, entry) => total + decimalToNumber(entry.value), 0);
  const saidas = sheet.entries
    .filter((entry) => entry.type === "SAIDA")
    .reduce((total, entry) => total + decimalToNumber(entry.value), 0);
  const saldo = entradas - saidas;

  return (
    <AppShell name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Financeiro"
        title={sheet.name}
        description={sheet.purpose ?? "Planilha financeira independente."}
        actions={
          <>
            <FinancialPrivacyToggle />
            <Link className="button secondary" href="/financeiro"><ArrowLeft size={18} /> Voltar</Link>
          </>
        }
      />

      <section className="kpi-row">
        <article className="kpi"><span>Entradas</span><strong><PrivateValue>{formatCurrency(entradas)}</PrivateValue></strong></article>
        <article className="kpi"><span>Saídas</span><strong><PrivateValue>{formatCurrency(saidas)}</PrivateValue></strong></article>
        <article className="kpi"><span>Saldo</span><strong><PrivateValue>{formatCurrency(saldo)}</PrivateValue></strong></article>
      </section>

      {canWrite ? (
        <section className="sheet-settings">
          <form className="panel sheet-settings-form" action={updateSheetAction}>
            <input type="hidden" name="id" value={sheet.id} />
            <label>Nome da planilha<input name="name" defaultValue={sheet.name} required /></label>
            <label>Finalidade<input name="purpose" defaultValue={sheet.purpose ?? ""} /></label>
            <label className="wide-field">Observações<textarea name="description" defaultValue={sheet.description ?? ""} rows={3} /></label>
            <button type="submit">Salvar alterações</button>
          </form>

          <form className="panel delete-zone" action={deleteSheetAction}>
            <input type="hidden" name="id" value={sheet.id} />
            <div>
              <strong>Excluir planilha</strong>
              <span>Use apenas se tiver certeza. Esta ação remove também os lançamentos.</span>
            </div>
            <ConfirmSubmitButton className="danger-button inline-danger" message={`Excluir a planilha ${sheet.name} e todos os lançamentos?`}><Trash2 size={16} /> Deletar planilha</ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      {canWrite ? (
        <form className="panel entry-form" action={createEntryAction}>
          <input type="hidden" name="sheetId" value={sheet.id} />
          <label>Data<input name="date" type="date" defaultValue={toDateInput(new Date())} /></label>
          <label>Tipo<select name="type" defaultValue="SAIDA"><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select></label>
          <label>Descrição<input name="item" placeholder="Ex: combustível" required /></label>
          <label>Qtd.<input name="quantity" placeholder="Opcional" /></label>
          <label>Valor<input name="value" placeholder="0,00" required /></label>
          <label className="wide-field">Observação<input name="notes" placeholder="Opcional" /></label>
          <button type="submit"><Plus size={18} /> Adicionar lançamento</button>
        </form>
      ) : null}

      <section className="panel table-panel section-gap">
        <div className="table-head">
          <h2>Lançamentos</h2>
          <span>{sheet.entries.length} registros</span>
        </div>
        <div className="finance-table">
          <div className="finance-row header"><span>Data</span><span>Descrição</span><span>Tipo</span><span>Qtd.</span><span>Valor</span><span></span></div>
          {sheet.entries.map((entry) => (
            <div className="finance-row" key={entry.id}>
              <span data-label="Data">{formatDate(entry.date)}</span>
              <span data-label="Descrição">{entry.item}{entry.notes ? <small> {entry.notes}</small> : null}</span>
              <span data-label="Tipo" className={entry.type === "ENTRADA" ? "tag income" : "tag expense"}>{entry.type}</span>
              <span data-label="Qtd.">{entry.quantity ?? "-"}</span>
              <strong data-label="Valor"><PrivateValue>{formatCurrency(decimalToNumber(entry.value))}</PrivateValue></strong>
              <span className="finance-row-action" data-label="Ações">
                {canWrite ? (
                  <form action={deleteEntryAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="sheetId" value={sheet.id} />
                    <ConfirmSubmitButton className="icon-danger" aria-label="Excluir lançamento" message={`Excluir o lançamento ${entry.item}?`}><Trash2 size={16} /></ConfirmSubmitButton>
                  </form>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
