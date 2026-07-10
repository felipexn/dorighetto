import { ShieldCheck, UserPlus } from "lucide-react";
import { createUserAction, deleteUserAction, toggleUserActiveAction, updateUserAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { defaultPermissionsForRole, permissionOptions, resolvePermissions, roleLabels, roleOptions } from "@/lib/user-permissions";


const usageDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo"
});

function formatUsageDate(value: Date | null) {
  return value ? usageDateFormatter.format(value) : "Nunca";
}

function formatUsageCount(value: number) {
  return `${value} ${value === 1 ? "uso" : "usos"}`;
}

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="role" defaultValue={defaultValue ?? "LEITOR"} required>
      {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
    </select>
  );
}

function PermissionChecks({ permissions }: { permissions: Record<(typeof permissionOptions)[number]["name"], boolean> }) {
  return (
    <div className="permission-grid">
      {permissionOptions.map(({ name, label }) => (
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
            <label>Senha<input name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" title="A senha deve ter pelo menos 8 caracteres." required /></label>
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

              <div className="user-usage-grid" aria-label={`Uso registrado para ${user.name}`}>
                <div>
                  <span>Último login</span>
                  <strong>{formatUsageDate(user.lastLoginAt)}</strong>
                </div>
                <div>
                  <span>Último uso</span>
                  <strong>{formatUsageDate(user.lastActivityAt)}</strong>
                  <small>{user.lastActivityPath ?? "Sem tela registrada"}</small>
                </div>
                <div>
                  <span>Viu gráficos</span>
                  <strong>{formatUsageDate(user.lastReportViewAt)}</strong>
                </div>
                <div>
                  <span>Total registrado</span>
                  <strong>{formatUsageCount(user.activityCount)}</strong>
                </div>
              </div>

              <form className="user-form" action={updateUserAction}>
                <input type="hidden" name="id" value={user.id} />
                <div className="user-form-fields">
                  <label>Nome<input name="name" defaultValue={user.name} required /></label>
                  <label>Login ou e-mail<input name="email" defaultValue={user.email} required /></label>
                  <label>Nova senha <small>Deixe em branco para manter</small><input name="password" type="password" minLength={8} placeholder="Opcional, mínimo 8 caracteres" title="A nova senha deve ter pelo menos 8 caracteres." /></label>
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
                  {user.isActive ? (
                    <ConfirmSubmitButton className="secondary" disabled={isCurrentUser} message={`Desativar o usuário ${user.name}?`}>Desativar</ConfirmSubmitButton>
                  ) : (
                    <button className="secondary" type="submit" disabled={isCurrentUser}>Ativar</button>
                  )}
                </form>
                <form action={deleteUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <ConfirmSubmitButton className="danger-button inline-danger" disabled={isCurrentUser} message={`Excluir definitivamente o usuário ${user.name}?`}>Excluir</ConfirmSubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
