import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Drill, LogOut, Sheet, UserCog, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { UserRole } from "@prisma/client";
import type { ReactNode } from "react";
import type { UserPermissionSet } from "@/lib/user-permissions";
import { roleLabels } from "@/lib/user-permissions";

type AppShellProps = {
  active?: string;
  role: UserRole;
  name: string;
  permissions: UserPermissionSet;
  children: ReactNode;
};

export function AppShell({ active = "financeiro", role, name, permissions, children }: AppShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={64} height={64} priority />
          <div>
            <strong>Dorighetto</strong>
            <span>Perfuração</span>
          </div>
        </Link>

        <nav className="nav-list">
          {permissions.canAccessFinance ? (
            <Link className={active === "financeiro" ? "active" : ""} href="/financeiro">
              <Sheet size={18} /> Financeiro
            </Link>
          ) : null}
          {permissions.canAccessDaily ? (
            <Link className={active === "diarias" ? "active" : ""} href="/diarias">
              <CalendarDays size={18} /> Pagamentos
            </Link>
          ) : null}
          {permissions.canAccessDrilling ? (
            <Link className={active === "perfuracao" ? "active" : ""} href="/perfuracao">
              <Drill size={18} /> Perfuração
            </Link>
          ) : null}
        </nav>

        <div className="user-box">
          <div>
            <UserRound size={18} />
            <span>{name}</span>
          </div>
          <small>{roleLabels[role]}</small>
          {permissions.canManageUsers ? (
            <div className="admin-nav-area">
              <span>Área do administrador</span>
              <Link className={active === "usuarios" ? "active" : ""} href="/usuarios">
                <UserCog size={18} /> Usuários
              </Link>
            </div>
          ) : null}
          <form action={logoutAction}>
            <button className="ghost-button" type="submit"><LogOut size={16} /> Sair</button>
          </form>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}

