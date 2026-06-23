"use server";

import bcrypt from "bcryptjs";
import { EntryType, Prisma, type UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireAdmin, requireModuleWrite } from "@/lib/session";
import { parseMoney, requiredText } from "@/lib/finance";
import { makeReceiptNumber, parseDecimal } from "@/lib/diarias";
import { ensureDrillingSchema } from "@/lib/drilling-schema";
import { normalizeDrillingBankName, normalizeDrillingMachineName, normalizeDrillingShift } from "@/lib/drilling";
import { ensurePayrollSchema } from "@/lib/payroll-schema";
import { ensureUserSchema } from "@/lib/user-schema";
import { defaultPermissionsForRole, firstAllowedPath, resolvePermissions } from "@/lib/user-permissions";

function drillingFormError(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function normalizeDrillingHoleCode(value: string) {
  const raw = value.trim().toUpperCase();
  if (raw === "AUX") return "AUX";

  const digits = raw.replace(/^F/i, "").replace(/\D/g, "");
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
      drillingFormError(errorPath, `Horas invÃƒÂ¡lidas para a parada ${item.reason}.`);
    }

    if (hours.lte(0)) {
      drillingFormError(errorPath, `Horas invÃƒÂ¡lidas para a parada ${item.reason}.`);
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
    drillingFormError(errorPath, "Adicione pelo menos um furo com ID e metragem, uma parada ou preencha a observaÃƒÂ§ÃƒÂ£o.");
  }

  return pairs.map((item) => {
    let meters: Prisma.Decimal;
    try {
      meters = parseDecimal(item.meters);
    } catch {
      drillingFormError(errorPath, `Metragem invÃƒÂ¡lida para o furo ${item.code}.`);
    }

    if (meters.lte(0)) {
      drillingFormError(errorPath, `Metragem invÃƒÂ¡lida para o furo ${item.code}.`);
    }

    return {
      holeCode: item.code,
      meters
    };
  });
}

export async function loginAction(_: unknown, formData: FormData) {
  await ensureUserSchema(prisma);

  const email = requiredText(formData, "email").toLowerCase();
  const password = requiredText(formData, "password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Usuário ou senha inválidos." };
  }

  const permissions = resolvePermissions(user);
  await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions
  });

  redirect(firstAllowedPath(permissions));
}
export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function createSheetAction(formData: FormData) {
  await requireModuleWrite("financeiro");

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
  await requireModuleWrite("financeiro");
  const id = requiredText(formData, "id");
  await prisma.financialSheet.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/financeiro");
  redirect("/financeiro");
}

export async function updateSheetAction(formData: FormData) {
  await requireModuleWrite("financeiro");

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
  await requireModuleWrite("financeiro");

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
  await requireModuleWrite("financeiro");

  const id = requiredText(formData, "id");
  const sheetId = requiredText(formData, "sheetId");
  await prisma.financialEntry.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/planilha/${sheetId}`);
}

export async function createDailyEntryAction(formData: FormData) {
  await requireModuleWrite("diarias");

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
  await requireModuleWrite("diarias");

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
  await requireModuleWrite("diarias");

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

export async function addPayrollAdvanceAction(formData: FormData) {
  await requireModuleWrite("diarias");
  await ensurePayrollSchema(prisma);

  const employeeName = requiredText(formData, "employeeName").toUpperCase();
  const amount = parseDecimal(formData.get("amount"));
  const notes = requiredText(formData, "notes");

  if (amount.lte(0)) {
    throw new Error("Informe um valor de vale maior que zero.");
  }

  await prisma.payrollAdvance.create({
    data: {
      employeeName,
      amount,
      notes
    }
  });

  revalidatePath("/diarias");
  revalidatePath(`/diarias/pagamento/${encodeURIComponent(employeeName)}`);
  redirect(`/diarias/pagamento/${encodeURIComponent(employeeName)}`);
}

export async function deletePayrollAdvanceAction(formData: FormData) {
  await requireModuleWrite("diarias");
  await ensurePayrollSchema(prisma);

  const id = requiredText(formData, "id");
  const employeeName = requiredText(formData, "employeeName").toUpperCase();

  await prisma.payrollAdvance.deleteMany({
    where: {
      id,
      employeeName,
      status: "PENDENTE"
    }
  });

  revalidatePath("/diarias");
  revalidatePath(`/diarias/pagamento/${encodeURIComponent(employeeName)}`);
  redirect(`/diarias/pagamento/${encodeURIComponent(employeeName)}`);
}

export async function payFortnightAction(formData: FormData) {
  await requireModuleWrite("diarias");
  await ensurePayrollSchema(prisma);

  const employeeName = requiredText(formData, "employeeName").toUpperCase();

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

    const advances = await tx.payrollAdvance.findMany({
      where: {
        employeeName,
        status: "PENDENTE"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (entries.length === 0) {
      throw new Error("NÃƒÂ£o existem diÃƒÂ¡rias pendentes para este funcionÃƒÂ¡rio.");
    }

    const start = entries[0].date;
    const end = entries[entries.length - 1].date;
    const totalDaily = entries.reduce((total, entry) => total.add(entry.dailyValue), new Prisma.Decimal(0));
    const totalOvertime = entries.reduce((total, entry) => total.add(entry.overtimeTotal), new Prisma.Decimal(0));
    const totalGross = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));
    const totalAdvance = advances.reduce((total, advance) => total.add(advance.amount), new Prisma.Decimal(0));
    const totalPaid = totalGross.sub(totalAdvance);

    const created = await tx.payrollClosure.create({
      data: {
        employeeName,
        role: entries[0].role,
        periodStart: start,
        periodEnd: end,
        daysWorked: entries.length,
        totalDaily,
        totalOvertime,
        totalAdvance,
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

    if (advances.length > 0) {
      await tx.payrollAdvance.updateMany({
        where: {
          id: {
            in: advances.map((advance) => advance.id)
          }
        },
        data: {
          status: "DESCONTADO",
          closureId: created.id
        }
      });
    }

    return created;
  });

  revalidatePath("/diarias");
  revalidatePath("/diarias/historico");
  redirect(`/diarias/fechamento/${closure.id}`);
}

export async function createDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");
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
        machineName: normalizeDrillingMachineName(requiredText(formData, "machineName")),
        bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
        activityCode: requiredText(formData, "activityCode").toUpperCase(),
        shift: normalizeDrillingShift(String(formData.get("shift") ?? "")),
        motorStart: requiredText(formData, "motorStart"),
        motorEnd: requiredText(formData, "motorEnd"),
        notes: notes || null,
        holes: holes.length > 0 ? { create: holes } : undefined,
        downtimes: downtimes.length > 0 ? { create: downtimes } : undefined
      }
    });
  } catch {
    redirect("/perfuracao?erro=NÃƒÂ£o%20foi%20possÃƒÂ­vel%20salvar.%20Sincronize%20o%20schema%20do%20banco%20e%20tente%20novamente.");
  }

  revalidatePath("/perfuracao");
}

export async function updateDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");
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
          machineName: normalizeDrillingMachineName(requiredText(formData, "machineName")),
          bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
          activityCode: requiredText(formData, "activityCode").toUpperCase(),
          shift: normalizeDrillingShift(String(formData.get("shift") ?? "")),
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
    drillingFormError(errorPath, "NÃƒÂ£o foi possÃƒÂ­vel atualizar a ficha. Sincronize o schema do banco e tente novamente.");
  }

  revalidatePath("/perfuracao");
  revalidatePath(errorPath);
  redirect("/perfuracao");
}

export async function deleteDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");
  await ensureDrillingSchema(prisma);
  const id = requiredText(formData, "id");
  await prisma.drillingRecord.delete({ where: { id } });
  revalidatePath("/perfuracao");
}






function readUserRole(formData: FormData): UserRole {
  const role = requiredText(formData, "role") as UserRole;
  if (!["ADMIN", "FINANCEIRO", "RH", "PERFURACAO", "LEITOR"].includes(role)) {
    throw new Error("Tipo de usuário inválido.");
  }
  return role;
}

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function readUserPermissionData(formData: FormData, role: UserRole) {
  if (role === "ADMIN") return defaultPermissionsForRole("ADMIN");

  return {
    canAccessFinance: checkbox(formData, "canAccessFinance"),
    canWriteFinance: checkbox(formData, "canWriteFinance"),
    canAccessDaily: checkbox(formData, "canAccessDaily"),
    canWriteDaily: checkbox(formData, "canWriteDaily"),
    canAccessDrilling: checkbox(formData, "canAccessDrilling"),
    canWriteDrilling: checkbox(formData, "canWriteDrilling"),
    canManageUsers: checkbox(formData, "canManageUsers")
  };
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  await ensureUserSchema(prisma);

  const role = readUserRole(formData);
  const password = requiredText(formData, "password");
  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = readUserPermissionData(formData, role);

  await prisma.user.create({
    data: {
      name: requiredText(formData, "name"),
      email: requiredText(formData, "email").toLowerCase(),
      passwordHash,
      role,
      isActive: checkbox(formData, "isActive"),
      ...permissions
    }
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();
  await ensureUserSchema(prisma);

  const id = requiredText(formData, "id");
  const role = readUserRole(formData);
  const password = String(formData.get("password") ?? "").trim();
  const permissions = readUserPermissionData(formData, role);

  await prisma.user.update({
    where: { id },
    data: {
      name: requiredText(formData, "name"),
      email: requiredText(formData, "email").toLowerCase(),
      role,
      isActive: checkbox(formData, "isActive"),
      ...permissions,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
    }
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function toggleUserActiveAction(formData: FormData) {
  const session = await requireAdmin();
  await ensureUserSchema(prisma);

  const id = requiredText(formData, "id");
  if (id === session.userId) {
    throw new Error("Você não pode desativar o seu próprio usuário.");
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: checkbox(formData, "isActive") }
  });

  revalidatePath("/usuarios");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();
  await ensureUserSchema(prisma);

  const id = requiredText(formData, "id");
  if (id === session.userId) {
    throw new Error("Você não pode excluir o seu próprio usuário.");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/usuarios");
}
