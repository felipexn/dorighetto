"use server";

import bcrypt from "bcryptjs";
import { EntryType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireAdmin } from "@/lib/session";
import { parseMoney, requiredText } from "@/lib/finance";
import { makeReceiptNumber, parseDecimal } from "@/lib/diarias";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { normalizeDrillingBankName } from "@/lib/drilling";

function drillingFormError(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function normalizeDrillingHoleCode(value: string) {
  const digits = value.trim().replace(/^F/i, "").replace(/\D/g, "");
  return digits ? `F${digits}` : "";
}

function readDrillingDowntimes(formData: FormData, errorPath: string) {
  const rawHours = formData.getAll("downtimeHours").map((value) => String(value).trim());
  const rawReasons = formData.getAll("downtimeReason").map((value) => String(value).trim());
  const rawOtherReasons = formData.getAll("downtimeOtherReason").map((value) => String(value).trim());
  const pairs = rawHours
    .map((hours, index) => {
      const selectedReason = rawReasons[index] ?? "";
      const otherReason = rawOtherReasons[index] ?? "";
      return {
        hours,
        reason: selectedReason === "Outro" ? otherReason : selectedReason,
        selectedReason
      };
    })
    .filter((item) => item.hours || item.reason || item.selectedReason);

  const incomplete = pairs.find((item) => !item.hours || !item.reason);
  if (incomplete) {
    drillingFormError(errorPath, "Informe as horas e o motivo da parada.");
  }

  return pairs.map((item) => {
    let hours: Prisma.Decimal;
    try {
      hours = parseDecimal(item.hours);
    } catch {
      drillingFormError(errorPath, `Horas inválidas para a parada ${item.reason}.`);
    }

    if (hours.lte(0)) {
      drillingFormError(errorPath, `Horas inválidas para a parada ${item.reason}.`);
    }

    return {
      reason: item.reason.trim(),
      hours
    };
  });
}

function readDrillingHoles(formData: FormData, errorPath: string, notes: string, hasDowntime: boolean) {
  const rawHoleCodes = formData.getAll("holeCode").map((value) => String(value).trim());
  const rawHoleMeters = formData.getAll("holeMeters").map((value) => String(value).trim());
  const pairs = rawHoleCodes
    .map((code, index) => ({
      code: normalizeDrillingHoleCode(code),
      meters: rawHoleMeters[index] ?? ""
    }))
    .filter((item) => item.code || item.meters);

  const incomplete = pairs.find((item) => !item.code || !item.meters);
  if (incomplete?.code && !incomplete.meters) {
    drillingFormError(errorPath, `Informe a metragem do furo ${incomplete.code}.`);
  }
  if (incomplete?.meters && !incomplete.code) {
    drillingFormError(errorPath, "Informe o ID do furo que possui metragem preenchida.");
  }

  if (pairs.length === 0 && !notes && !hasDowntime) {
    drillingFormError(errorPath, "Adicione pelo menos um furo com ID e metragem, uma parada ou preencha a observação.");
  }

  return pairs.map((item) => {
    let meters: Prisma.Decimal;
    try {
      meters = parseDecimal(item.meters);
    } catch {
      drillingFormError(errorPath, `Metragem inválida para o furo ${item.code}.`);
    }

    if (meters.lte(0)) {
      drillingFormError(errorPath, `Metragem inválida para o furo ${item.code}.`);
    }

    return {
      holeCode: item.code,
      meters
    };
  });
}

export async function loginAction(_: unknown, formData: FormData) {
  const email = requiredText(formData, "email").toLowerCase();
  const password = requiredText(formData, "password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email ou senha inválidos." };
  }

  await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });

  redirect("/financeiro");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
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
      throw new Error("Não existem diárias pendentes para este funcionário.");
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
  await ensureDrillingSchema(prisma);

  const date = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const downtimes = readDrillingDowntimes(formData, "/perfuracao");
  const holes = readDrillingHoles(formData, "/perfuracao", notes, downtimes.length > 0);

  try {
    await prisma.drillingRecord.create({
      data: {
        date: date ? new Date(`${date}T00:00:00.000Z`) : new Date(),
        teamName: requiredText(formData, "teamName").toUpperCase(),
        machineName: requiredText(formData, "machineName").toUpperCase(),
        bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
        activityCode: requiredText(formData, "activityCode").toUpperCase(),
        motorStart: requiredText(formData, "motorStart"),
        motorEnd: requiredText(formData, "motorEnd"),
        notes: notes || null,
        holes: holes.length > 0 ? { create: holes } : undefined,
        downtimes: downtimes.length > 0 ? { create: downtimes } : undefined
      }
    });
  } catch {
    redirect("/perfuracao?erro=Não%20foi%20possível%20salvar.%20Sincronize%20o%20schema%20do%20banco%20e%20tente%20novamente.");
  }

  revalidatePath("/perfuracao");
}

export async function updateDrillingRecordAction(formData: FormData) {
  await requireAdmin();
  await ensureDrillingSchema(prisma);

  const id = requiredText(formData, "id");
  const errorPath = `/perfuracao/${id}/editar`;
  const date = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const downtimes = readDrillingDowntimes(formData, errorPath);
  const holes = readDrillingHoles(formData, errorPath, notes, downtimes.length > 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.drillingHole.deleteMany({ where: { recordId: id } });
      await tx.drillingDowntime.deleteMany({ where: { recordId: id } });
      await tx.drillingRecord.update({
        where: { id },
        data: {
          date: date ? new Date(`${date}T00:00:00.000Z`) : new Date(),
          teamName: requiredText(formData, "teamName").toUpperCase(),
          machineName: requiredText(formData, "machineName").toUpperCase(),
          bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
          activityCode: requiredText(formData, "activityCode").toUpperCase(),
          motorStart: requiredText(formData, "motorStart"),
          motorEnd: requiredText(formData, "motorEnd"),
          notes: notes || null
        }
      });

      if (holes.length > 0) {
        await tx.drillingHole.createMany({
          data: holes.map((hole) => ({
            recordId: id,
            holeCode: hole.holeCode,
            meters: hole.meters
          }))
        });
      }

      if (downtimes.length > 0) {
        await tx.drillingDowntime.createMany({
          data: downtimes.map((downtime) => ({
            recordId: id,
            reason: downtime.reason,
            hours: downtime.hours
          }))
        });
      }
    });
  } catch {
    drillingFormError(errorPath, "Não foi possível atualizar a ficha. Sincronize o schema do banco e tente novamente.");
  }

  revalidatePath("/perfuracao");
  revalidatePath(errorPath);
  redirect("/perfuracao");
}

export async function deleteDrillingRecordAction(formData: FormData) {
  await requireAdmin();
  await ensureDrillingSchema(prisma);
  const id = requiredText(formData, "id");
  await prisma.drillingRecord.delete({ where: { id } });
  revalidatePath("/perfuracao");
}





