"use client";

import Link from "next/link";
import { Download, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteDailyEntryAction } from "@/app/actions";

type PaymentEntry = {
  id: string;
  date: string;
  employeeName: string;
  role: string;
  employeeType: string;
  dailyValue: string;
  overtimeHours: string;
  overtimeRate: string;
  monthlySalary: string;
  dayTotal: string;
  status: "PENDENTE" | "PAGO";
  closureId: string | null;
};

type Props = {
  entries: PaymentEntry[];
  canWrite: boolean;
};

const PREVIEW_LIMIT = 10;

export function PaymentsTable({ entries, canWrite }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = useMemo(() => expanded ? entries : entries.slice(0, PREVIEW_LIMIT), [entries, expanded]);
  const hiddenCount = Math.max(entries.length - PREVIEW_LIMIT, 0);

  return (
    <div className="payments-table-wrap">
      {hiddenCount > 0 ? (
        <div className="table-compact-notice">
          <span>Mostrando {visibleEntries.length} de {entries.length} registros.</span>
          <button className="secondary compact" type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Mostrar somente 10" : `Ver todos (${entries.length})`}
          </button>
        </div>
      ) : null}

      <div className="daily-table payments-table">
        <div className="daily-row header"><span>Data</span><span>Funcionário</span><span>Função</span><span>Tipo</span><span>Diária</span><span>H.E.</span><span>Valor H.E.</span><span>Salário ref.</span><span>Total</span><span>Status</span><span>Recibo</span></div>
        {visibleEntries.map((entry) => (
          <div className="daily-row" key={entry.id}>
            <span data-label="Data">{entry.date}</span>
            <span data-label="Funcionário">{entry.employeeName}</span>
            <span data-label="Função">{entry.role}</span>
            <span data-label="Tipo" className="tag neutral">{entry.employeeType}</span>
            <span data-label="Diária">{entry.employeeType === "DIARISTA" ? entry.dailyValue : "-"}</span>
            <span data-label="H.E.">{entry.overtimeHours}h</span>
            <span data-label="Valor H.E.">{entry.overtimeRate}</span>
            <span data-label="Salário ref.">{entry.monthlySalary}</span>
            <strong data-label="Total">{entry.dayTotal}</strong>
            <span data-label="Status" className={entry.status === "PAGO" ? "tag income" : "tag pending"}>{entry.status}</span>
            {canWrite && entry.status === "PENDENTE" ? (
              <div className="row-actions" data-label="Ações">
                <Link className="icon-button" href={`/diarias/${entry.id}/editar`} aria-label="Editar pagamento"><Pencil size={16} /></Link>
                <form action={deleteDailyEntryAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="icon-danger" type="submit" aria-label="Deletar pagamento"><Trash2 size={16} /></button>
                </form>
              </div>
            ) : entry.status === "PAGO" && entry.closureId ? (
              <Link className="button secondary compact" data-label="Recibo" href={`/diarias/fechamento/${entry.closureId}`}>
                <Download size={16} /> Abrir
              </Link>
            ) : <span data-label="Recibo" />}
          </div>
        ))}
      </div>
    </div>
  );
}
