"use client";

import { CheckCircle2 } from "lucide-react";
import { payFortnightAction } from "@/app/actions";

type Props = {
  employeeName: string;
  total: string;
};

export function ConfirmPaymentForm({ employeeName, total }: Props) {
  return (
    <form
      action={payFortnightAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(`Confirmar pagamento de ${employeeName} no valor de ${total}?`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="employeeName" value={employeeName} />
      <button type="submit"><CheckCircle2 size={18} /> Confirmar pagamento</button>
    </form>
  );
}
