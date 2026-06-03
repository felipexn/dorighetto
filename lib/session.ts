import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";

const cookieName = "dorighetto_session";

type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
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
    return payload as SessionPayload;
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
  if (session.role !== "ADMIN") redirect("/");
  return session;
}

