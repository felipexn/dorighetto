import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FinancialPrivacyToggle } from "@/components/financial-privacy-toggle";
import { PrivateValue } from "@/components/private-value";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatCurrency } from "@/lib/format";
import { requireSession } from "@/lib/session";

async function getSheets() {
  const sheets = await prisma.financialSheet.findMany({
    include: {
      entries: {
        select: {
          type: true,
          value: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return sheets.map((sheet) => {
    const entradas = sheet.entries
      .filter((entry) => entry.type === "ENTRADA")
      .reduce((total, entry) => total + decimalToNumber(entry.value), 0);
    const saidas = sheet.entries
      .filter((entry) => entry.type === "SAIDA")
      .reduce((total, entry) => total + decimalToNumber(entry.value), 0);

    return {
      ...sheet,
      entradas,
      saidas,
      saldo: entradas - saidas,
      count: sheet.entries.length
    };
  });
}

export default async function FinanceiroPage() {
  const session = await requireSession();
  const sheets = await getSheets();
  const isAdmin = session.role === "ADMIN";

  return (
    <AppShell name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Financeiro"
        title="Planilhas de entrada e saida"
        description="Cada planilha e independente. Os valores nao sao somados entre finalidades diferentes."
        actions={
          <>
            <FinancialPrivacyToggle />
            {isAdmin ? (
              <Link className="button" href="/financeiro/nova">
                <Plus size={18} /> Nova planilha
              </Link>
            ) : null}
          </>
        }
      />

      {sheets.length === 0 ? (
        <EmptyState
          title="Nenhuma planilha criada"
          text={isAdmin ? "Crie a primeira planilha para comecar os lancamentos." : "Aguarde um administrador criar uma planilha."}
        />
      ) : (
        <section className="sheet-grid">
          {sheets.map((sheet) => (
            <article className="sheet-card" key={sheet.id}>
              <Link href={`/financeiro/planilha/${sheet.id}`}>
                <span className="eyebrow">{sheet.count} lancamentos</span>
                <h2>{sheet.name}</h2>
                {sheet.purpose ? <p>{sheet.purpose}</p> : null}
                <div className="sheet-metrics">
                  <div><span>Entradas</span><strong><PrivateValue>{formatCurrency(sheet.entradas)}</PrivateValue></strong></div>
                  <div><span>Saidas</span><strong><PrivateValue>{formatCurrency(sheet.saidas)}</PrivateValue></strong></div>
                  <div><span>Saldo</span><strong><PrivateValue>{formatCurrency(sheet.saldo)}</PrivateValue></strong></div>
                </div>
              </Link>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
