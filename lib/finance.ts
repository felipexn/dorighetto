import { Prisma } from "@prisma/client";

export function parseMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace("R$", "").replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Valor inválido.");
  }

  return new Prisma.Decimal(parsed.toFixed(2));
}

export function requiredText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }
  return value;
}


