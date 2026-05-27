"use server";

import bcrypt from "bcryptjs";
import { EntryType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireAdmin } from "@/lib/session";
import { parseMoney, requiredText } from "@/lib/finance";
import { makeReceiptNumber, parseDecimal } from "@/lib/diarias";

export async function loginAction(_: unknown, formData: FormData) {
  const email = requiredText(formData, "email").toLowerCase();
  const password = requiredText(formData, "password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email ou senha invalidos." };
  }

  await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });

  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function createSheetAction(formData: FormData) {
  await requireAdmin();

  const sheet = await prisma.financialSheet.create({
    data: {
      name: requiredText(formData, "name"),
      purpose: String(formData.get("purpose") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null
    }
  });

  revalidatePath("/");
  revalidatePath("/financeiro");
  redirect(`/financeiro/planilha/${sheet.id}`);
}

export async function deleteSheetAction(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  await prisma.financialSheet.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/financeiro");
  redirect("/financeiro");
}

export async function updateSheetAction(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData, "id");
  await prisma.financialSheet.update({
    where: { id },
    data: {
      name: requiredText(formData, "name"),
      purpose: String(formData.get("purpose") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null
    }
  });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/planilha/${id}`);
}

export async function createEntryAction(formData: FormData) {
  await requireAdmin();

  const sheetId = requiredText(formData, "sheetId");
  const type = requiredText(formData, "type") as EntryType;
  const date = String(formData.get("date") ?? "").trim();

  await prisma.financialEntry.create({
    data: {
      sheetId,
      type,
      date: date ? new Date(`${date}T00:00:00.000Z`) : new Date(),
      item: requiredText(formData, "item"),
      quantity: String(formData.get("quantity") ?? "").trim() || null,
      value: parseMoney(formData.get("value")),
      notes: String(formData.get("notes") ?? "").trim() || null
    }
  });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/planilha/${sheetId}`);
}

export async function deleteEntryAction(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData, "id");
  const sheetId = requiredText(formData, "sheetId");
  await prisma.financialEntry.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/planilha/${sheetId}`);
}

export async function createDailyEntryAction(formData: FormData) {
  await requireAdmin();

  const date = requiredText(formData, "date");
  const dailyValue = parseDecimal(formData.get("dailyValue"));
  const overtimeHours = parseDecimal(formData.get("overtimeHours"));
  const overtimeRate = dailyValue.div(8);
  const overtimeTotal = overtimeHours.mul(overtimeRate);
  const dayTotal = dailyValue.add(overtimeTotal);

  await prisma.dailyEntry.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      employeeName: requiredText(formData, "employeeName").toUpperCase(),
      role: requiredText(formData, "role") as "AJUDANTE" | "OPERADOR",
      dailyValue,
      overtimeHours,
      overtimeRate,
      overtimeTotal,
      dayTotal,
      notes: String(formData.get("notes") ?? "").trim() || null
    }
  });

  revalidatePath("/diarias");
}

export async function deleteDailyEntryAction(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData, "id");
  await prisma.dailyEntry.delete({
    where: {
      id,
      status: "PENDENTE"
    }
  });

  revalidatePath("/diarias");
}

export async function updateDailyEntryAction(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData, "id");
  const date = requiredText(formData, "date");
  const dailyValue = parseDecimal(formData.get("dailyValue"));
  const overtimeHours = parseDecimal(formData.get("overtimeHours"));
  const overtimeRate = dailyValue.div(8);
  const overtimeTotal = overtimeHours.mul(overtimeRate);
  const dayTotal = dailyValue.add(overtimeTotal);

  await prisma.dailyEntry.update({
    where: {
      id,
      status: "PENDENTE"
    },
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      employeeName: requiredText(formData, "employeeName").toUpperCase(),
      role: requiredText(formData, "role") as "AJUDANTE" | "OPERADOR",
      dailyValue,
      overtimeHours,
      overtimeRate,
      overtimeTotal,
      dayTotal,
      notes: String(formData.get("notes") ?? "").trim() || null
    }
  });

  revalidatePath("/diarias");
  redirect("/diarias?funcionario=&funcao=&status=PENDENTE");
}

export async function payFortnightAction(formData: FormData) {
  await requireAdmin();

  const employeeName = requiredText(formData, "employeeName");

  const closure = await prisma.$transaction(async (tx) => {
    const entries = await tx.dailyEntry.findMany({
      where: {
        employeeName,
        status: "PENDENTE"
      },
      orderBy: {
        date: "asc"
      }
    });

    if (entries.length === 0) {
      throw new Error("Nao existem diarias pendentes para este funcionario.");
    }

    const start = entries[0].date;
    const end = entries[entries.length - 1].date;
    const totalDaily = entries.reduce((total, entry) => total.add(entry.dailyValue), new Prisma.Decimal(0));
    const totalOvertime = entries.reduce((total, entry) => total.add(entry.overtimeTotal), new Prisma.Decimal(0));
    const totalPaid = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));

    const created = await tx.payrollClosure.create({
      data: {
        employeeName,
        role: entries[0].role,
        periodStart: start,
        periodEnd: end,
        daysWorked: entries.length,
        totalDaily,
        totalOvertime,
        totalPaid,
        receiptNumber: makeReceiptNumber()
      }
    });

    await tx.dailyEntry.updateMany({
      where: {
        id: {
          in: entries.map((entry) => entry.id)
        }
      },
      data: {
        status: "PAGO",
        closureId: created.id
      }
    });

    return created;
  });

  revalidatePath("/diarias");
  revalidatePath("/diarias/historico");
  redirect(`/diarias/fechamento/${closure.id}`);
}

export async function createDrillingRecordAction(formData: FormData) {
  await requireAdmin();

  const rawHoleCodes = formData.getAll("holeCode").map((value) => String(value).trim());
  const rawHoleMeters = formData.getAll("holeMeters").map((value) => String(value).trim());
  const pairs = rawHoleCodes
    .map((code, index) => ({
      code,
      meters: rawHoleMeters[index] ?? ""
    }))
    .filter((item) => item.code);

  if (pairs.length === 0) {
    throw new Error("Adicione pelo menos um furo.");
  }

  const holes = pairs.map((item) => {
    const metersRaw = item.meters || "0";
    const meters = parseDecimal(metersRaw);
    if (meters.lte(0)) {
      throw new Error(`Metragem invalida para o furo ${item.code}.`);
    }
    return {
      holeCode: item.code.toUpperCase(),
      meters
    };
  });

  const date = String(formData.get("date") ?? "").trim();

  try {
    await prisma.drillingRecord.create({
      data: {
        date: date ? new Date(`${date}T00:00:00.000Z`) : new Date(),
        teamName: requiredText(formData, "teamName").toUpperCase(),
        machineName: requiredText(formData, "machineName").toUpperCase(),
        bankName: requiredText(formData, "bankName").toUpperCase(),
        activityCode: requiredText(formData, "activityCode").toUpperCase(),
        motorStart: requiredText(formData, "motorStart"),
        motorEnd: requiredText(formData, "motorEnd"),
        notes: String(formData.get("notes") ?? "").trim() || null,
        holes: {
          create: holes
        }
      }
    });
  } catch {
    redirect("/perfuracao?erro=Nao%20foi%20possivel%20salvar.%20Sincronize%20o%20schema%20do%20banco%20e%20tente%20novamente.");
  }

  revalidatePath("/perfuracao");
}

export async function deleteDrillingRecordAction(formData: FormData) {
  await requireAdmin();
  const id = requiredText(formData, "id");
  await prisma.drillingRecord.delete({ where: { id } });
  revalidatePath("/perfuracao");
}
