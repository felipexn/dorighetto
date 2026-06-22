import { ShieldCheck, UserPlus } from "lucide-react";
import { createUserAction, deleteUserAction, toggleUserActiveAction, updateUserAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ensureUserSchema } from "@/lib/user-schema";
import { defaultPermissionsForRole, resolvePermissions, roleLabels, roleOptions } from "@/lib/user-permissions";

const permissionFields = [
  ["canAccessFinance", "Acessar financeiro"],
  ["canWriteFinance", "Editar financeiro"],
  ["canAccessDaily", "Acessar diárias"],
  ["canWriteDaily", "Editar diárias e pagamentos"],
  ["canAccessDrilling", "Acessar perfuração"],
  ["canWriteDrilling", "Editar perfuração"],
  ["canManageUsers", "Gerenciar usuários"]
] as const;

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="role" defaultValue={defaultValue ?? "LEITOR"} required>
      {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
    </select>
  );
}

function PermissionChecks({ permissions }: { permissions: Record<(typeof permissionFields)[number][0], boolean> }) {
  return (
    <div className="permission-grid">
      {permissionFields.map(([name, label]) => (
        <label className="permission-check" key={name}>
          <input name={name} type="checkbox" defaultChecked={permissions[name]} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default async function UsuariosPage() {
  const session = await requireAdmin();
  await ensureUserSchema(prisma);

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  const defaultReaderPermissions = defaultPermissionsForRole("LEITOR");

  return (
    <AppShell active="usuarios" name={session.name} role={session.role} permissions={session.permissions}>
      <PageHeader
        eyebrow="Administração"
        title="Usuários e permissões"
        description="Cadastre acessos, altere senhas e controle quais módulos cada pessoa pode visualizar ou editar."
      />

      <section className="panel user-admin-section">
        <div className="table-head">
          <h2>Novo usuário</h2>
          <span>Crie acessos por função</span>
        </div>
        <form className="user-form" action={createUserAction}>
          <div className="user-form-fields">
            <label>Nome<input name="name" placeholder="Ex: Najara" required /></label>
            <label>Login ou e-mail<input name="email" placeholder="Ex: najara" required /></label>
            <label>Senha<input name="password" type="password" placeholder="Senha inicial" required /></label>
            <label>Tipo de acesso<RoleSelect /></label>
          </div>
          <PermissionChecks permissions={defaultReaderPermissions} />
          <button type="submit"><UserPlus size={18} /> Cadastrar usuário</button>
        </form>
      </section>

      <section className="user-list section-gap">
        {users.map((user) => {
          const permissions = resolvePermissions(user);
          const isCurrentUser = user.id === session.userId;
          return (
            <article className="panel user-card" key={user.id}>
              <div className="user-card-head">
                <div>
                  <span className="eyebrow">{roleLabels[user.role]}</span>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                </div>
                <span className={user.isActive ? "status-pill active" : "status-pill inactive"}>{user.isActive ? "Ativo" : "Inativo"}</span>
              </div>

              <form className="user-form" action={updateUserAction}>
                <input type="hidden" name="id" value={user.id} />
                <div className="user-form-fields">
                  <label>Nome<input name="name" defaultValue={user.name} required /></label>
                  <label>Login ou e-mail<input name="email" defaultValue={user.email} required /></label>
                  <label>Nova senha <small>Deixe em branco para manter</small><input name="password" type="password" placeholder="Opcional" /></label>
                  <label>Tipo de acesso<RoleSelect defaultValue={user.role} /></label>
                </div>
                <label className="permission-check compact-check">
                  <input name="isActive" type="checkbox" defaultChecked={user.isActive} disabled={isCurrentUser} />
                  <span>Usuário ativo</span>
                </label>
                {isCurrentUser ? <input type="hidden" name="isActive" value="on" /> : null}
                <PermissionChecks permissions={permissions} />
                <div className="user-actions">
                  <button type="submit"><ShieldCheck size={18} /> Salvar usuário</button>
                </div>
              </form>

              <div className="user-actions danger-actions">
                <form action={toggleUserActiveAction}>
                  <input type="hidden" name="id" value={user.id} />
                  {!user.isActive ? <input type="hidden" name="isActive" value="on" /> : null}
                  <button className="secondary" type="submit" disabled={isCurrentUser}>{user.isActive ? "Desativar" : "Ativar"}</button>
                </form>
                <form action={deleteUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <button className="danger-button inline-danger" type="submit" disabled={isCurrentUser}>Excluir</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
