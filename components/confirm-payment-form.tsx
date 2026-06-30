"use client";

import { CheckCircle2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { payFortnightAction } from "@/app/actions";

type Props = {
  employeeName: string;
  total: string;
};

export function ConfirmPaymentForm({ employeeName, total }: Props) {
  return (
    <form
      action={payFortnightAction}
    >
      <input type="hidden" name="employeeName" value={employeeName} />
      <ConfirmSubmitButton message={`Confirmar pagamento de ${employeeName} no valor de ${total}?`}><CheckCircle2 size={18} /> Confirmar pagamento</ConfirmSubmitButton>
    </form>
  );
}
