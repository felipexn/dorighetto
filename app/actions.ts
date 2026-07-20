"use server";

import bcrypt from "bcryptjs";
import { Prisma, type DailyRole, type EmployeeType, type EntryType, type UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireAdmin, requireModuleWrite } from "@/lib/session";
import { recordUserLogin } from "@/lib/user-activity";
import { optionalDecimal, optionalText, parseDecimal, parseMoney, readBoolean, readDate, readEnum, readLoginIdentifier, requiredText } from "@/lib/form-validation";
import { makeReceiptNumber } from "@/lib/diarias";
import {
  normalizeDrillingBankName,
  normalizeDrillingHoleCode,
  normalizeDrillingMachineName,
  normalizeDrillingShift
} from "@/lib/drilling";
import { firstAllowedPath, readUserPermissionData, resolvePermissions, userRoleValues } from "@/lib/user-permissions";

const minimumPasswordLength = 8;

function assertStrongPassword(password: string) {
  if (password.length < minimumPasswordLength) {
    throw new Error(`A senha deve ter pelo menos ${minimumPasswordLength} caracteres.`);
  }
}

const entryTypeValues = ["ENTRADA", "SAIDA"] as const satisfies readonly EntryType[];
const dailyRoleValues = ["AJUDANTE", "OPERADOR"] as const satisfies readonly DailyRole[];
const employeeTypeValues = ["DIARISTA", "FICHADO"] as const satisfies readonly EmployeeType[];

function drillingFormError(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
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
  const email = readLoginIdentifier(formData, "email");
  const password = requiredText(formData, "password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Usuário ou senha inválidos." };
  }

  const permissions = resolvePermissions(user);
  const remember = formData.get("remember") === "on";
  await recordUserLogin(user.id);
  await createSession({ userId: user.id }, remember);

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
      purpose: optionalText(formData, "purpose"),
      description: optionalText(formData, "description")
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
      purpose: optionalText(formData, "purpose"),
      description: optionalText(formData, "description")
    }
  });

  revalidatePath("/");
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/planilha/${id}`);
}

export async function createEntryAction(formData: FormData) {
  await requireModuleWrite("financeiro");

  const sheetId = requiredText(formData, "sheetId");
  const type = readEnum(formData, "type", entryTypeValues, "Tipo de lançamento inválido.");
  const date = readDate(formData, "date");

  await prisma.financialEntry.create({
    data: {
      sheetId,
      type,
      date,
      item: requiredText(formData, "item"),
      quantity: optionalText(formData, "quantity"),
      value: parseMoney(formData.get("value")),
      notes: optionalText(formData, "notes")
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


function readDailyRole(formData: FormData): DailyRole {
  return readEnum(formData, "role", dailyRoleValues, "Função inválida.");
}

function readEmployeeType(formData: FormData): EmployeeType {
  if (!formData.has("employeeType")) return "DIARISTA";
  return readEnum(formData, "employeeType", employeeTypeValues, "Tipo de funcionário inválido.");
}


async function findPayrollEmployee(employeeName: string) {
  return prisma.payrollEmployee.findUnique({ where: { name: employeeName } });
}

async function buildDailyEntryData(formData: FormData) {
  const date = readDate(formData, "date");
  const employeeName = requiredText(formData, "employeeName").toUpperCase();
  const employee = await findPayrollEmployee(employeeName);
  const requestedType = readEmployeeType(formData);
  const overtimeHours = parseDecimal(formData.get("overtimeHours"));
  const enteredOvertimeRate = optionalDecimal(formData.get("overtimeRate"));
  const notes = optionalText(formData, "notes");

  if (employee?.type === "FICHADO" || requestedType === "FICHADO") {
    if (!employee || employee.type !== "FICHADO") {
      throw new Error("Cadastre o funcionário fichado antes de lançar horas extras.");
    }

    const overtimeRate = enteredOvertimeRate ?? employee.defaultOvertimeRate ?? new Prisma.Decimal(0);
    if (overtimeHours.lte(0)) {
      throw new Error("Informe a quantidade de horas extras do funcionário fichado.");
    }
    if (overtimeRate.lte(0)) {
      throw new Error("Informe o valor da hora extra do funcionário fichado.");
    }

    const overtimeTotal = overtimeHours.mul(overtimeRate);
    return {
      date,
      employeeName,
      employeeId: employee.id,
      role: employee.role,
      employeeType: "FICHADO" as EmployeeType,
      monthlySalary: employee.monthlySalary,
      dailyValue: new Prisma.Decimal(0),
      overtimeHours,
      overtimeRate,
      overtimeTotal,
      dayTotal: overtimeTotal,
      notes
    };
  }

  const dailyValue = optionalDecimal(formData.get("dailyValue"));
  if (!dailyValue || dailyValue.lte(0)) {
    throw new Error("Informe o valor da diária do funcionário diarista.");
  }

  const role = readDailyRole(formData);
  const overtimeRate = enteredOvertimeRate ?? dailyValue.div(8);
  const overtimeTotal = overtimeHours.mul(overtimeRate);
  const dayTotal = dailyValue.add(overtimeTotal);

  return {
    date,
    employeeName,
    employeeId: employee?.id ?? null,
    role,
    employeeType: "DIARISTA" as EmployeeType,
    monthlySalary: null,
    dailyValue,
    overtimeHours,
    overtimeRate,
    overtimeTotal,
    dayTotal,
    notes
  };
}

export async function createPayrollEmployeeAction(formData: FormData) {
  await requireModuleWrite("diarias");

  const name = requiredText(formData, "name").toUpperCase();
  const role = readDailyRole(formData);
  const monthlySalary = optionalDecimal(formData.get("monthlySalary"));
  const defaultOvertimeRate = optionalDecimal(formData.get("defaultOvertimeRate"));

  await prisma.payrollEmployee.upsert({
    where: { name },
    create: {
      name,
      role,
      type: "FICHADO",
      dailyValue: null,
      monthlySalary,
      defaultOvertimeRate,
      isActive: true
    },
    update: {
      role,
      type: "FICHADO",
      dailyValue: null,
      monthlySalary,
      defaultOvertimeRate,
      isActive: true
    }
  });

  revalidatePath("/diarias");
}

export async function updatePayrollEmployeeAction(formData: FormData) {
  await requireModuleWrite("diarias");

  const id = requiredText(formData, "id");
  const name = requiredText(formData, "name").toUpperCase();
  const role = readDailyRole(formData);
  const monthlySalary = optionalDecimal(formData.get("monthlySalary"));
  const defaultOvertimeRate = optionalDecimal(formData.get("defaultOvertimeRate"));

  await prisma.payrollEmployee.update({
    where: { id },
    data: {
      name,
      role,
      type: "FICHADO",
      dailyValue: null,
      monthlySalary,
      defaultOvertimeRate,
      isActive: true
    }
  });

  await prisma.dailyEntry.updateMany({
    where: { employeeId: id, status: "PENDENTE" },
    data: { employeeName: name, role, employeeType: "FICHADO", monthlySalary }
  });

  revalidatePath("/diarias");
}

export async function deletePayrollEmployeeAction(formData: FormData) {
  await requireModuleWrite("diarias");

  const id = requiredText(formData, "id");
  await prisma.payrollEmployee.update({
    where: { id },
    data: { isActive: false }
  });

  revalidatePath("/diarias");
}

export async function createDailyEntryAction(formData: FormData) {
  await requireModuleWrite("diarias");

  await prisma.dailyEntry.create({
    data: await buildDailyEntryData(formData)
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

  await prisma.dailyEntry.update({
    where: {
      id,
      status: "PENDENTE"
    },
    data: await buildDailyEntryData(formData)
  });

  revalidatePath("/diarias");
  redirect("/diarias?funcionario=&funcao=&status=PENDENTE");
}

export async function addPayrollAdditionAction(formData: FormData) {
  await requireModuleWrite("diarias");

  const employeeName = requiredText(formData, "employeeName").toUpperCase();
  const amount = parseDecimal(formData.get("amount"));
  const notes = requiredText(formData, "notes");

  if (amount.lte(0)) {
    throw new Error("Informe um valor de acréscimo maior que zero.");
  }

  await prisma.payrollAddition.create({
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

export async function deletePayrollAdditionAction(formData: FormData) {
  await requireModuleWrite("diarias");

  const id = requiredText(formData, "id");
  const employeeName = requiredText(formData, "employeeName").toUpperCase();

  await prisma.payrollAddition.deleteMany({
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

export async function addPayrollAdvanceAction(formData: FormData) {
  await requireModuleWrite("diarias");

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

    const additions = await tx.payrollAddition.findMany({
      where: {
        employeeName,
        status: "PENDENTE"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (entries.length === 0) {
      throw new Error("Não existem diárias pendentes para este funcionário.");
    }

    const start = entries[0].date;
    const end = entries[entries.length - 1].date;
    const totalDaily = entries.reduce((total, entry) => total.add(entry.dailyValue), new Prisma.Decimal(0));
    const totalOvertime = entries.reduce((total, entry) => total.add(entry.overtimeTotal), new Prisma.Decimal(0));
    const totalGross = entries.reduce((total, entry) => total.add(entry.dayTotal), new Prisma.Decimal(0));
    const totalAdvance = advances.reduce((total, advance) => total.add(advance.amount), new Prisma.Decimal(0));
    const totalAddition = additions.reduce((total, addition) => total.add(addition.amount), new Prisma.Decimal(0));
    const totalPaid = totalGross.add(totalAddition).sub(totalAdvance);

    const created = await tx.payrollClosure.create({
      data: {
        employeeName,
        role: entries[0].role,
        employeeType: entries[0].employeeType,
        periodStart: start,
        periodEnd: end,
        daysWorked: entries.length,
        totalDaily,
        totalOvertime,
        totalAdvance,
        totalAddition,
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

    if (additions.length > 0) {
      await tx.payrollAddition.updateMany({
        where: {
          id: {
            in: additions.map((addition) => addition.id)
          }
        },
        data: {
          status: "INCLUIDO",
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

export async function createDrillingFuelEntryAction(formData: FormData) {
  await requireModuleWrite("perfuracao");

  const date = readDate(formData, "date");
  const machineName = normalizeDrillingMachineName(requiredText(formData, "machineName"));
  const quantity = parseDecimal(formData.get("quantity"));
  const notes = optionalText(formData, "notes");

  if (quantity.lte(0)) {
    redirect(`/perfuracao?erro=${encodeURIComponent("Informe a quantidade de diesel.")}`);
  }

  try {
    await prisma.drillingFuelEntry.create({
      data: {
        date,
        machineName,
        quantity,
        notes
      }
    });
  } catch {
    redirect(`/perfuracao?erro=${encodeURIComponent("Não foi possível salvar o diesel. Rode npm run db:ensure-schema e tente novamente.")}`);
  }

  revalidatePath("/perfuracao");
}
export async function createDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");
  const date = readDate(formData, "date");
  const notes = optionalText(formData, "notes") ?? "";
  const downtimes = readDrillingDowntimes(formData, "/perfuracao");
  const holes = readDrillingHoles(formData, "/perfuracao", notes, downtimes.length > 0);

  try {
    await prisma.drillingRecord.create({
      data: {
        date,
        teamName: requiredText(formData, "teamName").toUpperCase(),
        machineName: normalizeDrillingMachineName(requiredText(formData, "machineName")),
        bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
        benchName: optionalText(formData, "benchName") ? normalizeDrillingBankName(String(formData.get("benchName") ?? "")) : null,
        blastPlan: optionalText(formData, "blastPlan")?.toUpperCase() ?? null,
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
    redirect(`/perfuracao?erro=${encodeURIComponent("Não foi possível salvar. Rode npm run db:ensure-schema e tente novamente.")}`);
  }

  revalidatePath("/perfuracao");
}

export async function updateDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");

  const id = requiredText(formData, "id");
  const errorPath = `/perfuracao/${id}/editar`;
  const date = readDate(formData, "date");
  const notes = optionalText(formData, "notes") ?? "";
  const downtimes = readDrillingDowntimes(formData, errorPath);
  const holes = readDrillingHoles(formData, errorPath, notes, downtimes.length > 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.drillingHole.deleteMany({ where: { recordId: id } });
      await tx.drillingDowntime.deleteMany({ where: { recordId: id } });
      await tx.drillingRecord.update({
        where: { id },
        data: {
          date,
          teamName: requiredText(formData, "teamName").toUpperCase(),
          machineName: normalizeDrillingMachineName(requiredText(formData, "machineName")),
          bankName: normalizeDrillingBankName(requiredText(formData, "bankName")),
          benchName: optionalText(formData, "benchName") ? normalizeDrillingBankName(String(formData.get("benchName") ?? "")) : null,
          blastPlan: optionalText(formData, "blastPlan")?.toUpperCase() ?? null,
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
    drillingFormError(errorPath, "Não foi possível atualizar a ficha. Rode npm run db:ensure-schema e tente novamente.");
  }

  revalidatePath("/perfuracao");
  revalidatePath(errorPath);
  redirect("/perfuracao");
}

export async function deleteDrillingRecordAction(formData: FormData) {
  await requireModuleWrite("perfuracao");
  const id = requiredText(formData, "id");
  await prisma.drillingRecord.delete({ where: { id } });
  revalidatePath("/perfuracao");
}






function readUserRole(formData: FormData): UserRole {
  return readEnum(formData, "role", userRoleValues, "Tipo de usuário inválido.");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const role = readUserRole(formData);
  const password = requiredText(formData, "password");
  assertStrongPassword(password);
  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = readUserPermissionData(formData, role);

  await prisma.user.create({
    data: {
      name: requiredText(formData, "name"),
      email: readLoginIdentifier(formData, "email"),
      passwordHash,
      role,
      isActive: readBoolean(formData, "isActive"),
      ...permissions
    }
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData, "id");
  const role = readUserRole(formData);
  const password = String(formData.get("password") ?? "").trim();
  if (password) assertStrongPassword(password);
  const permissions = readUserPermissionData(formData, role);

  await prisma.user.update({
    where: { id },
    data: {
      name: requiredText(formData, "name"),
      email: readLoginIdentifier(formData, "email"),
      role,
      isActive: readBoolean(formData, "isActive"),
      ...permissions,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
    }
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function toggleUserActiveAction(formData: FormData) {
  const session = await requireAdmin();

  const id = requiredText(formData, "id");
  if (id === session.userId) {
    throw new Error("Você não pode desativar o seu próprio usuário.");
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: readBoolean(formData, "isActive") }
  });

  revalidatePath("/usuarios");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();

  const id = requiredText(formData, "id");
  if (id === session.userId) {
    throw new Error("Você não pode excluir o seu próprio usuário.");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/usuarios");
}

