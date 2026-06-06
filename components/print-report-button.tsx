"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button className="secondary no-print" type="button" onClick={() => window.print()}>
      <Printer size={18} /> Imprimir relatório
    </button>
  );
}
