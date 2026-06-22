import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { createSheetAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { requireModuleWrite } from "@/lib/session";

export default async function NovaPlanilhaPage() {
  const session = await requireModuleWrite("financeiro");

  return (
    <AppShell name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Nova planilha"
        title="Criar planilha financeira"
        actions={<Link className="button secondary" href="/financeiro"><ArrowLeft size={18} /> Voltar</Link>}
      />

      <form className="panel form-panel narrow" action={createSheetAction}>
        <label>
          Nome da planilha
          <input name="name" placeholder="Ex.: Compressor 080 Celeste" required />
        </label>

        <label>
          Finalidade
          <input name="purpose" placeholder="Ex.: controle de despesas do compressor" />
        </label>

        <label>
          Observações
          <textarea name="description" placeholder="Detalhes adicionais desta planilha" rows={5} />
        </label>

        <button type="submit"><Plus size={18} /> Criar planilha</button>
      </form>
    </AppShell>
  );
}



