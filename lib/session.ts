import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import type { ModuleKey, UserPermissionSet } from "@/lib/user-permissions";
import { canAccessModule, canWriteModule, defaultPermissionsForRole, firstAllowedPath } from "@/lib/user-permissions";

const cookieName = "dorighetto_session";

type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissionSet;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());

  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as Partial<SessionPayload>;
    if (!session.role || !session.userId || !session.name || !session.email) return null;
    return {
      userId: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      permissions: session.permissions ?? defaultPermissionsForRole(session.role === "ADMIN" ? "ADMIN" : "LEITOR")
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "ADMIN" && !session.permissions.canManageUsers) redirect(firstAllowedPath(session.permissions));
  return session;
}

export async function requireModule(module: ModuleKey) {
  const session = await requireSession();
  if (!canAccessModule(session.permissions, module)) redirect(firstAllowedPath(session.permissions));
  return session;
}

export async function requireModuleWrite(module: ModuleKey) {
  const session = await requireModule(module);
  if (!canWriteModule(session.permissions, module)) redirect(firstAllowedPath(session.permissions));
  return session;
}
