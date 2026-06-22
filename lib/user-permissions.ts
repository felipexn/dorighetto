import type { UserRole } from "@prisma/client";

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

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  FINANCEIRO: "Financeiro",
  RH: "RH / Diárias",
  PERFURACAO: "Perfuração",
  LEITOR: "Leitor"
};

export const roleOptions: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: roleLabels.ADMIN },
  { value: "FINANCEIRO", label: roleLabels.FINANCEIRO },
  { value: "RH", label: roleLabels.RH },
  { value: "PERFURACAO", label: roleLabels.PERFURACAO },
  { value: "LEITOR", label: roleLabels.LEITOR }
];

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
