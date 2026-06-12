import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { updateDrillingRecordAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PerfuracaoFormFields } from "@/components/perfuracao-form";
import { PageHeader } from "@/components/ui";
import { decimalToNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { toDateInput } from "@/lib/diarias";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { normalizeDrillingBankName } from "@/lib/drilling";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function EditarPerfuracaoPage({ params, searchParams }: Props) {
  const session = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const actionError = query.erro ? decodeURIComponent(query.erro) : "";

  await ensureDrillingSchema(prisma);

  const [record, equipes] = await Promise.all([
    prisma.drillingRecord.findUnique({
      where: { id },
      include: {
        holes: {
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    prisma.drillingRecord.findMany({
      distinct: ["teamName"],
      select: { teamName: true },
      orderBy: { teamName: "asc" }
    })
  ]);

  if (!record) notFound();

  const initialHoles = record.holes.map((hole) => ({
    code: hole.holeCode,
    meters: decimalToNumber(hole.meters).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }));

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role}>
      <PageHeader
        eyebrow="Editar perfuração"
        title={`Ficha ${record.teamName}`}
        description="Altere dados da ficha, observação e furos lançados."
        actions={<Link className="button secondary" href="/perfuracao"><ArrowLeft size={18} /> Voltar</Link>}
      />

      {actionError ? <section className="form-error">{actionError}</section> : null}

      <form className="panel perf-form" action={updateDrillingRecordAction}>
        <input type="hidden" name="id" value={record.id} />

        <label>Data<input name="date" type="date" defaultValue={toDateInput(record.date)} required /></label>
        <label>Equipe
          <input name="teamName" list="team-options-edit" placeholder="Ex: EQUIPE 01" defaultValue={record.teamName} required />
          <datalist id="team-options-edit">
            {equipes.map((item) => <option key={item.teamName} value={item.teamName} />)}
          </datalist>
        </label>
        <label>Perfuratriz<input name="machineName" placeholder="Ex: PERF 080" defaultValue={record.machineName} required /></label>
        <label>Banco<input name="bankName" placeholder="Ex: BANCO CELESTE" defaultValue={normalizeDrillingBankName(record.bankName)} required /></label>
        <label>H. motor inicial<input name="motorStart" placeholder="Ex: 1245" defaultValue={record.motorStart} required /></label>
        <label>H. motor final<input name="motorEnd" placeholder="Ex: 1276" defaultValue={record.motorEnd} required /></label>
        <label>Código da atividade<input name="activityCode" placeholder="Ex: AT-234" defaultValue={record.activityCode} required /></label>
        <label className="wide-field">Observação<input name="notes" placeholder="Opcional" defaultValue={record.notes ?? ""} /></label>
        <PerfuracaoFormFields initialHoles={initialHoles} />
        <button type="submit"><Save size={18} /> Salvar alterações</button>
      </form>
    </AppShell>
  );
}
