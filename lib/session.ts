import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordUserActivity, type ActivityOptions } from "@/lib/user-activity";
import type { ModuleKey, UserPermissionSet } from "@/lib/user-permissions";
import { canAccessModule, canWriteModule, firstAllowedPath, resolvePermissions } from "@/lib/user-permissions";

const cookieName = "dorighetto_session";
const defaultSessionMaxAge = 60 * 60 * 8;
const rememberedSessionMaxAge = 60 * 60 * 24 * 30;

type SessionTokenPayload = {
  userId: string;
};

type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissionSet;
};

const moduleActivityLabels: Record<ModuleKey, string> = {
  financeiro: "Financeiro",
  diarias: "Pagamentos",
  perfuracao: "Perfuração",
  usuarios: "Tela de usuários"
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionTokenPayload, remember = false) {
  const maxAge = remember ? rememberedSessionMaxAge : defaultSessionMaxAge;

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as Partial<SessionTokenPayload>;
    if (!session.userId || typeof session.userId !== "string") return null;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canAccessFinance: true,
        canWriteFinance: true,
        canAccessDaily: true,
        canWriteDaily: true,
        canAccessDrilling: true,
        canWriteDrilling: true,
        canManageUsers: true
      }
    });

    if (!user?.isActive) return null;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: resolvePermissions(user)
    };
  } catch {
    return null;
  }
}

export async function requireSession(activityLabel = "Uso do sistema", activityOptions?: ActivityOptions) {
  const session = await getSession();
  if (!session) redirect("/login");
  await recordUserActivity(session.userId, activityLabel, activityOptions);
  return session;
}

export async function requireAdmin(activityLabel = "Tela de usuários") {
  const session = await requireSession(activityLabel);
  if (session.role !== "ADMIN" && !session.permissions.canManageUsers) redirect(firstAllowedPath(session.permissions));
  return session;
}

export async function requireModule(module: ModuleKey, activityLabel = moduleActivityLabels[module], activityOptions?: ActivityOptions) {
  const session = await requireSession(activityLabel, activityOptions);
  if (!canAccessModule(session.permissions, module)) redirect(firstAllowedPath(session.permissions));
  return session;
}

export async function requireModuleWrite(module: ModuleKey) {
  const session = await requireModule(module);
  if (!canWriteModule(session.permissions, module)) redirect(firstAllowedPath(session.permissions));
  return session;
}