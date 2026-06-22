import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DrillingReportDashboard } from "@/components/drilling-report-dashboard";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getDrillingReportData, type DrillingReportFilters } from "@/lib/drilling-report-data";

type SearchParams = Promise<DrillingReportFilters>;

export default async function RelatoriosPerfuracaoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireModule("perfuracao");
  const params = await searchParams;
  const initialData = await getDrillingReportData(prisma, params);

  return (
    <AppShell active="perfuracao" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios de perfuração"
        description="Gere prestação de contas por período e acompanhe a produtividade das equipes."
        actions={<Link className="button secondary" href="/perfuracao"><ArrowLeft size={18} /> Voltar para fichas</Link>}
      />
      <DrillingReportDashboard initialData={initialData} />
    </AppShell>
  );
}
