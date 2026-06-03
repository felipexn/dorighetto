import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { EntryType } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FinancialPrivacyToggle } from "@/components/financial-privacy-toggle";
import { PrivateValue } from "@/components/private-value";
import { PageHeader } from "@/components/ui";
import { createEntryAction, deleteEntryAction, deleteSheetAction, updateSheetAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PlanilhaPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
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
  const saídas = sheet.entries
    .filter((entry) => entry.type === "SAIDA")
    .reduce((total, entry) => total + decimalToNumber(entry.value), 0);
  const isAdmin = session.role === "ADMIN";

  return (
    <AppShell name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Planilha financeira"
        title={sheet.name}
        description={sheet.purpose ?? "Entradas e saídas desta finalidade."}
        actions={
          <>
            <FinancialPrivacyToggle />
            <Link className="button secondary" href="/financeiro"><ArrowLeft size={18} /> Voltar</Link>
          </>
        }
      />

      <section className="kpi-row">
        <div className="kpi"><span>Entradas</span><strong><PrivateValue>{formatCurrency(entradas)}</PrivateValue></strong></div>
        <div className="kpi"><span>Saídas</span><strong><PrivateValue>{formatCurrency(saídas)}</PrivateValue></strong></div>
        <div className="kpi"><span>Saldo da planilha</span><strong><PrivateValue>{formatCurrency(entradas - saídas)}</PrivateValue></strong></div>
      </section>

      {isAdmin ? (
        <section className="panel sheet-settings">
          <div>
            <span className="eyebrow">Configurações</span>
            <h2>Editar planilha</h2>
          </div>

          <form className="sheet-settings-form" action={updateSheetAction}>
            <input type="hidden" name="id" value={sheet.id} />
            <label>
              Nome
              <input name="name" defaultValue={sheet.name} required />
            </label>
            <label>
              Finalidade
              <input name="purpose" defaultValue={sheet.purpose ?? ""} />
            </label>
            <label className="wide-field">
              Observações
              <input name="description" defaultValue={sheet.description ?? ""} />
            </label>
            <button type="submit"><Save size={18} /> Salvar</button>
          </form>

          <form action={deleteSheetAction} className="delete-zone">
            <input type="hidden" name="id" value={sheet.id} />
            <div>
              <strong>Deletar planilha</strong>
              <span>Remove esta planilha e todos os lançamentos dela.</span>
            </div>
            <button className="danger-button inline-danger" type="submit"><Trash2 size={16} /> Deletar planilha</button>
          </form>
        </section>
      ) : null}

      {isAdmin ? (
        <form className="panel entry-form" action={createEntryAction}>
          <input type="hidden" name="sheetId" value={sheet.id} />
          <label>
            Data
            <input name="date" type="date" />
            <small>Se ficar vazio, será usada a data atual.</small>
          </label>
          <label>
            Tipo
            <select name="type" defaultValue={EntryType.SAIDA}>
              <option value={EntryType.SAIDA}>Saída</option>
              <option value={EntryType.ENTRADA}>Entrada</option>
            </select>
          </label>
          <label>
            Item
            <input name="item" placeholder="Descrição do item" required />
          </label>
          <label>
            Qtd
            <input name="quantity" placeholder="Ex.: 300 L" />
          </label>
          <label>
            Valor
            <input name="value" placeholder="0,00" required />
          </label>
          <label className="wide-field">
            Observações
            <input name="notes" placeholder="Opcional" />
          </label>
          <button type="submit"><Plus size={18} /> Adicionar</button>
        </form>
      ) : null}

      <section className="panel table-panel">
        <div className="table-head">
          <h2>Lançamentos</h2>
          <span>{sheet.entries.length} registros</span>
        </div>

        <div className="finance-table">
          <div className="finance-row header">
            <span>Data</span>
            <span>Item</span>
            <span>Qtd</span>
            <span>Tipo</span>
            <span>Valor</span>
            <span></span>
          </div>
          {sheet.entries.map((entry) => (
            <div className="finance-row" key={entry.id}>
              <span>{formatDate(entry.date)}</span>
              <span>{entry.item}</span>
              <span>{entry.quantity ?? "-"}</span>
              <span className={entry.type === "ENTRADA" ? "tag income" : "tag expense"}>{entry.type}</span>
              <strong><PrivateValue>{formatCurrency(decimalToNumber(entry.value))}</PrivateValue></strong>
              {isAdmin ? (
                <form action={deleteEntryAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="sheetId" value={sheet.id} />
                  <button className="icon-danger" type="submit" aria-label="Deletar lançamento"><Trash2 size={16} /></button>
                </form>
              ) : <span />}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}



