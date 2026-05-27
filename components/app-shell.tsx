import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Drill, LogOut, Sheet, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { UserRole } from "@prisma/client";
import type { ReactNode } from "react";

type AppShellProps = {
  active?: string;
  role: UserRole;
  name: string;
  children: ReactNode;
};

export function AppShell({ active = "financeiro", role, name, children }: AppShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuracao" width={64} height={64} priority />
          <div>
            <strong>Dorighetto</strong>
            <span>Perfuracao</span>
          </div>
        </Link>

        <nav className="nav-list">
          <Link className={active === "financeiro" ? "active" : ""} href="/financeiro">
            <Sheet size={18} /> Financeiro
          </Link>
          <Link className={active === "diarias" ? "active" : ""} href="/diarias">
            <CalendarDays size={18} /> Diarias
          </Link>
          <Link className={active === "perfuracao" ? "active" : ""} href="/perfuracao">
            <Drill size={18} /> Perfuracao
          </Link>
        </nav>

        <div className="user-box">
          <div>
            <UserRound size={18} />
            <span>{name}</span>
          </div>
          <small>{role === "ADMIN" ? "Administrador" : "Leitor"}</small>
          <form action={logoutAction}>
            <button className="ghost-button" type="submit"><LogOut size={16} /> Sair</button>
          </form>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}
