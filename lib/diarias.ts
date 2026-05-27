import { Prisma } from "@prisma/client";

export function parseDecimal(value: FormDataEntryValue | null, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Prisma.Decimal(fallback);

  const normalized = raw.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Valor invalido.");
  }

  return new Prisma.Decimal(parsed.toFixed(2));
}

export function currentFortnight() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (day <= 15) {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month, 15))
    };
  }

  return {
    start: new Date(Date.UTC(year, month, 16)),
    end: new Date(Date.UTC(year, month + 1, 0))
  };
}

export function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function makeReceiptNumber() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `REC-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
