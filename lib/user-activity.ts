import { prisma } from "@/lib/prisma";

export type ActivityOptions = {
  reportView?: boolean;
};

export async function recordUserActivity(userId: string, path: string, options: ActivityOptions = {}) {
  const now = new Date();

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActivityAt: now,
        lastActivityPath: path,
        activityCount: { increment: 1 },
        ...(options.reportView ? { lastReportViewAt: now } : {})
      }
    });
  } catch (error) {
    console.error("Nao foi possivel registrar uso do usuario.", error);
  }
}

export async function recordUserLogin(userId: string) {
  const now = new Date();

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: now,
        lastActivityAt: now,
        lastActivityPath: "Login",
        activityCount: { increment: 1 }
      }
    });
  } catch (error) {
    console.error("Nao foi possivel registrar login do usuario.", error);
  }
}