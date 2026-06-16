export const defaultDrillingMachineOptions = ["HIDRAULICA", "60", "70", "80"];

export function normalizeDrillingMachineName(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeDrillingBankName(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+(?=\d)/, "") || "0";
  }
  return trimmed;
}
