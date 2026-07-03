"use client";

import { useMemo, useState } from "react";
import { createDailyEntryAction } from "@/app/actions";

type FichadoOption = {
  name: string;
  role: "AJUDANTE" | "OPERADOR";
  monthlySalary: number | null;
  defaultOvertimeRate: number | null;
};

type Props = {
  today: string;
  employeeNames: string[];
  fichados: FichadoOption[];
};

function moneyInput(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moneyLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Não informado";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PaymentEntryForm({ today, employeeNames, fichados }: Props) {
  const [employeeName, setEmployeeName] = useState("");
  const normalizedName = employeeName.trim().toUpperCase();
  const selectedFichado = useMemo(
    () => fichados.find((employee) => employee.name === normalizedName),
    [fichados, normalizedName]
  );
  const isFichado = Boolean(selectedFichado);

  return (
    <form className="panel daily-form" action={createDailyEntryAction}>
      <div className="form-section-title wide-field">
        <span className="eyebrow">Lançamento</span>
        <h2>Adicionar pagamento</h2>
        <p>
          Diarista continua sendo lançado por nome, diária e horas extras. Fichado precisa estar cadastrado e recebe apenas horas extras.
        </p>
      </div>

      <label>Data<input name="date" type="date" defaultValue={today} required /></label>
      <label>Funcionário
        <input
          name="employeeName"
          list="employee-options"
          placeholder="Selecione ou digite novo nome"
          value={employeeName}
          onChange={(event) => setEmployeeName(event.target.value.toUpperCase())}
          required
        />
        <datalist id="employee-options">
          {employeeNames.map((name) => <option key={name} value={name} />)}
        </datalist>
      </label>

      {isFichado && selectedFichado ? (
        <>
          <input type="hidden" name="employeeType" value="FICHADO" />
          <input type="hidden" name="role" value={selectedFichado.role} />
          <div className="payroll-reference-card">
            <span>Funcionário fichado</span>
            <strong>{selectedFichado.role}</strong>
            <small>Salário mensal: {moneyLabel(selectedFichado.monthlySalary)}</small>
          </div>
          <label>Valor da hora extra
            <input name="overtimeRate" placeholder="0,00" defaultValue={moneyInput(selectedFichado.defaultOvertimeRate)} required />
          </label>
          <label>Horas extras<input name="overtimeHours" placeholder="0" required /></label>
        </>
      ) : (
        <>
          <input type="hidden" name="employeeType" value="DIARISTA" />
          <label>Função<select name="role" defaultValue="" required><option value="" disabled>Selecione</option><option>AJUDANTE</option><option>OPERADOR</option></select></label>
          <label>Diária<input name="dailyValue" placeholder="0,00" required /></label>
          <label>Horas extras<input name="overtimeHours" placeholder="0" /></label>
        </>
      )}

      <label className="wide-field">Observação<input name="notes" placeholder="Opcional" /></label>
      <button type="submit">Adicionar pagamento</button>
    </form>
  );
}
