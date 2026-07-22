import Link from "next/link";
import { ArrowLeft, ChevronDown, ClipboardList, Save, Settings2 } from "lucide-react";
import { notFound } from "next/navigation";
import { updateDrillingRecordAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PerfuracaoFormFields } from "@/components/perfuracao-form";
import { PageHeader } from "@/components/ui";
import { decimalToNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite } from "@/lib/session";
import { toDateInput } from "@/lib/diarias";
import {
  defaultDrillingMachineOptions,
  drillingShiftOptions,
  normalizeDrillingBankName,
  normalizeDrillingMachineName,
  normalizeDrillingShift
} from "@/lib/drilling";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function EditarPerfuracaoPage({ params, searchParams }: Props) {
  const session = await requireModuleWrite("perfuracao");
  const { id } = await params;
  const query = await searchParams;
  const actionError = query.erro ? decodeURIComponent(query.erro) : "";

  const [record, equipes, machines] = await Promise.all([
    prisma.drillingRecord.findUnique({
      where: { id },
      include: {
        holes: {
          orderBy: { createdAt: "asc" }
        },
        downtimes: {
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    prisma.drillingRecord.findMany({
      distinct: ["teamName"],
      select: { teamName: true },
      orderBy: { teamName: "asc" }
    }),
    prisma.drillingRecord.findMany({
      distinct: ["machineName"],
      select: { machineName: true },
      orderBy: { machineName: "asc" }
    })
  ]);

  if (!record) notFound();
  const machineOptions = Array.from(new Set([
    ...defaultDrillingMachineOptions,
    ...machines.map((item) => normalizeDrillingMachineName(item.machineName)).filter(Boolean),
    normalizeDrillingMachineName(record.machineName)
  ]));

  const initialHoles = record.holes.map((hole) => ({
    code: hole.holeCode,
    meters: decimalToNumber(hole.meters).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }));

  const initialDowntimes = record.downtimes.map((downtime) => ({
    reason: downtime.reason,
    hours: decimalToNumber(downtime.hours).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }));

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Editar perfuração"
        title={`Ficha ${record.teamName}`}
        description="Altere dados da ficha, observação e furos lançados."
        actions={<Link className="button secondary" href="/perfuracao"><ArrowLeft size={18} /> Voltar</Link>}
      />

      {actionError ? <section className="form-error">{actionError}</section> : null}

      <form className="panel perf-form perf-form-shell" action={updateDrillingRecordAction}>
        <input type="hidden" name="id" value={record.id} />

        <div className="perf-form-heading">
          <span className="section-icon large"><ClipboardList size={22} /></span>
          <div>
            <span className="eyebrow">Edição</span>
            <h2>Atualizar ficha</h2>
          </div>
        </div>

        <fieldset className="perf-field-group">
          <legend>Dados principais</legend>
          <div className="perf-field-grid">
            <label>Data<input name="date" type="date" defaultValue={toDateInput(record.date)} required /></label>
            <label>Equipe
              <input name="teamName" list="team-options-edit" placeholder="Ex: EQUIPE 01" defaultValue={record.teamName} required />
              <datalist id="team-options-edit">
                {equipes.map((item) => <option key={item.teamName} value={item.teamName} />)}
              </datalist>
            </label>
            <label>Perfuratriz
              <input name="machineName" list="machine-options-edit" placeholder="Ex: 80" defaultValue={normalizeDrillingMachineName(record.machineName)} required />
              <datalist id="machine-options-edit">
                {machineOptions.map((machine) => <option key={machine} value={machine} />)}
              </datalist>
            </label>
            <label>Turno
              <select name="shift" defaultValue={normalizeDrillingShift(record.shift)} required>
                {drillingShiftOptions.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
              </select>
            </label>
            <label>Banco<input name="bankName" placeholder="Ex: 1, 2 ou 3" defaultValue={normalizeDrillingBankName(record.bankName)} required /></label>
            <label>H. motor inicial<input name="motorStart" placeholder="Ex: 1245" defaultValue={record.motorStart} required /></label>
            <label>H. motor final<input name="motorEnd" placeholder="Ex: 1276" defaultValue={record.motorEnd} required /></label>
            <label>Código da atividade<input name="activityCode" placeholder="Ex: AT-234" defaultValue={record.activityCode} required /></label>
          </div>
        </fieldset>

        <details className="form-disclosure perf-optional-fields" open={Boolean(record.benchName || record.blastPlan || record.notes)}>
          <summary>
            <span className="form-section-title">
              <span className="section-icon"><Settings2 size={18} /></span>
              <span><strong>Informações opcionais</strong><small>Cava, plano de fogo e observação</small></span>
            </span>
            <ChevronDown size={19} />
          </summary>
          <div className="perf-field-grid disclosure-content">
            <label>Cava<input name="benchName" placeholder="Ex: Cava 03" defaultValue={record.benchName ? normalizeDrillingBankName(record.benchName) : ""} /></label>
            <label>Plano de fogo<input name="blastPlan" placeholder="Ex: PF-01" defaultValue={record.blastPlan ?? ""} /></label>
            <label className="wide-field">Observação<input name="notes" placeholder="Opcional" defaultValue={record.notes ?? ""} /></label>
          </div>
        </details>

        <PerfuracaoFormFields initialHoles={initialHoles} initialDowntimes={initialDowntimes} />

        <div className="perf-submit-bar">
          <span>Revise os dados antes de salvar.</span>
          <button type="submit"><Save size={18} /> Salvar alterações</button>
        </div>
      </form>
    </AppShell>
  );
}
