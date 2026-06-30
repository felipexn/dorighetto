import { Prisma } from "@prisma/client";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;

export function textValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function requiredText(formData: FormData, name: string, message = "Preencha todos os campos obrigatórios.") {
  const value = textValue(formData.get(name));
  if (!value) {
    throw new Error(message);
  }
  return value;
}

export function optionalText(formData: FormData, name: string) {
  return textValue(formData.get(name)) || null;
}

export function readLoginIdentifier(formData: FormData, name = "email") {
  const value = requiredText(formData, name, "Informe o login ou e-mail.").toLowerCase();
  if (/\s/.test(value) || value.length > 120 || (value.includes("@") && !emailPattern.test(value))) {
    throw new Error("Login ou e-mail inválido.");
  }
  return value;
}

export function readBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export function readEnum<T extends readonly string[]>(
  formData: FormData,
  name: string,
  allowed: T,
  message: string
): T[number] {
  const value = requiredText(formData, name);
  if (!allowed.includes(value)) {
    throw new Error(message);
  }
  return value;
}

export function readDate(formData: FormData, name: string, fallback = new Date()) {
  const raw = textValue(formData.get(name));
  if (!raw) return fallback;
  if (!dateInputPattern.test(raw)) {
    throw new Error("Data inválida.");
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data inválida.");
  }
  return date;
}

function decimalFromString(rawValue: string, removeThousandsDots: boolean) {
  const raw = rawValue.trim().replace("R$", "").replace(/\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : removeThousandsDots
      ? raw.replace(/\./g, "")
      : raw;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Valor inválido.");
  }

  return new Prisma.Decimal(parsed.toFixed(2));
}

export function parseMoney(value: FormDataEntryValue | null) {
  return decimalFromString(String(value ?? ""), false);
}

export function parseDecimal(value: FormDataEntryValue | null, fallback = 0) {
  const raw = textValue(value);
  if (!raw) return new Prisma.Decimal(fallback);
  return decimalFromString(raw, true);
}

export function optionalDecimal(value: FormDataEntryValue | null) {
  const raw = textValue(value);
  return raw ? parseDecimal(raw) : null;
}
