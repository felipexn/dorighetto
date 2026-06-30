import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { updateDailyEntryAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite } from "@/lib/session";
import { decimalToNumber } from "@/lib/format";
import { toDateInput } from "@/lib/diarias";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditarDiariaPage({ params }: Props) {
  const session = await requireModuleWrite("diarias");
  const { id } = await params;

  const [entry, employees] = await Promise.all([
    prisma.dailyEntry.findUnique({ where: { id }, include: { employee: true } }),
    prisma.payrollEmployee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    })
  ]);

  if (!entry || entry.status !== "PENDENTE") notFound();

  return (
    <AppShell active="diarias" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Editar pagamento"
        title={entry.employeeName}
        description="Altere este lançamento individual. Diarista soma diária e horas extras; fichado soma apenas horas extras."
        actions={<Link className="button secondary" href="/diarias?funcionario=&funcao=&status=PENDENTE"><ArrowLeft size={18} /> Voltar</Link>}
      />

      <form className="panel form-panel narrow" action={updateDailyEntryAction}>
        <input type="hidden" name="id" value={entry.id} />

        <label>
          Data
          <input name="date" type="date" defaultValue={toDateInput(entry.date)} required />
        </label>

        <label>
          Funcionário
          <input name="employeeName" list="employee-options-edit" defaultValue={entry.employeeName} required />
          <datalist id="employee-options-edit">
            {employees.map((employee) => <option key={employee.name} value={employee.name} />)}
          </datalist>
        </label>

        <label>
          Função
          <select name="role" defaultValue={entry.role}>
            <option>AJUDANTE</option>
            <option>OPERADOR</option>
          </select>
        </label>

        <label>
          Tipo
          <select name="employeeType" defaultValue={entry.employeeType}>
            <option>DIARISTA</option>
            <option>FICHADO</option>
          </select>
        </label>

        <label>
          Diária
          <input name="dailyValue" defaultValue={decimalToNumber(entry.dailyValue)} placeholder="Diarista" />
        </label>

        <label>
          Salário mensal
          <input name="monthlySalary" defaultValue={entry.monthlySalary ? decimalToNumber(entry.monthlySalary) : ""} placeholder="Referência para fichado" />
        </label>

        <label>
          Valor da hora extra
          <input name="overtimeRate" defaultValue={decimalToNumber(entry.overtimeRate)} placeholder="Valor H.E." />
        </label>

        <label>
          Horas extras
          <input name="overtimeHours" defaultValue={decimalToNumber(entry.overtimeHours)} />
        </label>

        <label>
          Observação
          <input name="notes" defaultValue={entry.notes ?? ""} />
        </label>

        <button type="submit"><Save size={18} /> Salvar alterações</button>
      </form>
    </AppShell>
  );
}
