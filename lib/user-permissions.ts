import type { UserRole } from "@prisma/client";
import { readBoolean } from "@/lib/form-validation";

export type ModuleKey = "financeiro" | "diarias" | "perfuracao" | "usuarios";

export type UserPermissionSet = {
  canAccessFinance: boolean;
  canWriteFinance: boolean;
  canAccessDaily: boolean;
  canWriteDaily: boolean;
  canAccessDrilling: boolean;
  canWriteDrilling: boolean;
  canManageUsers: boolean;
};

export type PermissionSource = UserPermissionSet & {
  role: UserRole;
  isActive?: boolean;
};

export const userRoleValues = ["ADMIN", "FINANCEIRO", "RH", "PERFURACAO", "LEITOR"] as const satisfies readonly UserRole[];

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  FINANCEIRO: "Financeiro",
  RH: "RH / Diárias",
  PERFURACAO: "Perfuração",
  LEITOR: "Leitor"
};

export const roleOptions: { value: UserRole; label: string }[] = userRoleValues.map((role) => ({
  value: role,
  label: roleLabels[role]
}));

export const permissionOptions = [
  { name: "canAccessFinance", label: "Acessar financeiro" },
  { name: "canWriteFinance", label: "Editar financeiro" },
  { name: "canAccessDaily", label: "Acessar diárias" },
  { name: "canWriteDaily", label: "Editar diárias e pagamentos" },
  { name: "canAccessDrilling", label: "Acessar perfuração" },
  { name: "canWriteDrilling", label: "Editar perfuração" },
  { name: "canManageUsers", label: "Gerenciar usuários" }
] as const satisfies readonly { name: keyof UserPermissionSet; label: string }[];

export type PermissionFieldName = (typeof permissionOptions)[number]["name"];

export function defaultPermissionsForRole(role: UserRole): UserPermissionSet {
  if (role === "ADMIN") {
    return {
      canAccessFinance: true,
      canWriteFinance: true,
      canAccessDaily: true,
      canWriteDaily: true,
      canAccessDrilling: true,
      canWriteDrilling: true,
      canManageUsers: true
    };
  }

  if (role === "FINANCEIRO") {
    return {
      canAccessFinance: true,
      canWriteFinance: true,
      canAccessDaily: false,
      canWriteDaily: false,
      canAccessDrilling: false,
      canWriteDrilling: false,
      canManageUsers: false
    };
  }

  if (role === "RH") {
    return {
      canAccessFinance: false,
      canWriteFinance: false,
      canAccessDaily: true,
      canWriteDaily: true,
      canAccessDrilling: false,
      canWriteDrilling: false,
      canManageUsers: false
    };
  }

  if (role === "PERFURACAO") {
    return {
      canAccessFinance: false,
      canWriteFinance: false,
      canAccessDaily: false,
      canWriteDaily: false,
      canAccessDrilling: true,
      canWriteDrilling: true,
      canManageUsers: false
    };
  }

  return {
    canAccessFinance: true,
    canWriteFinance: false,
    canAccessDaily: true,
    canWriteDaily: false,
    canAccessDrilling: true,
    canWriteDrilling: false,
    canManageUsers: false
  };
}

export function resolvePermissions(user: PermissionSource): UserPermissionSet {
  if (user.role === "ADMIN") return defaultPermissionsForRole("ADMIN");

  return {
    canAccessFinance: user.canAccessFinance,
    canWriteFinance: user.canWriteFinance && user.canAccessFinance,
    canAccessDaily: user.canAccessDaily,
    canWriteDaily: user.canWriteDaily && user.canAccessDaily,
    canAccessDrilling: user.canAccessDrilling,
    canWriteDrilling: user.canWriteDrilling && user.canAccessDrilling,
    canManageUsers: user.canManageUsers
  };
}

export function readUserPermissionData(formData: FormData, role: UserRole) {
  if (role === "ADMIN") return defaultPermissionsForRole("ADMIN");

  const permissions = permissionOptions.reduce((acc, option) => ({
    ...acc,
    [option.name]: readBoolean(formData, option.name)
  }), {} as UserPermissionSet);

  return resolvePermissions({ role, ...permissions });
}

export function canAccessModule(permissions: UserPermissionSet, module: ModuleKey) {
  if (module === "financeiro") return permissions.canAccessFinance;
  if (module === "diarias") return permissions.canAccessDaily;
  if (module === "perfuracao") return permissions.canAccessDrilling;
  return permissions.canManageUsers;
}

export function canWriteModule(permissions: UserPermissionSet, module: ModuleKey) {
  if (module === "financeiro") return permissions.canWriteFinance;
  if (module === "diarias") return permissions.canWriteDaily;
  if (module === "perfuracao") return permissions.canWriteDrilling;
  return permissions.canManageUsers;
}

export function firstAllowedPath(permissions: UserPermissionSet) {
  if (permissions.canAccessFinance) return "/financeiro";
  if (permissions.canAccessDaily) return "/diarias";
  if (permissions.canAccessDrilling) return "/perfuracao";
  if (permissions.canManageUsers) return "/usuarios";
  return "/login";
}
