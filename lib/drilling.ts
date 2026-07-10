export const defaultDrillingMachineOptions = ["HIDRAULICA", "60", "70", "80"];
export const drillingShiftOptions = [
  { value: "DIA", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" }
];

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

export function normalizeDrillingHoleCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "0" || normalized === "F0" || normalized === "AUX" ? "AUX" : normalized;
}

export function normalizeDrillingShift(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["NOTURNO", "NOITE", "NORTURNO", "NORTUDO"].includes(normalized)) {
    return "NOTURNO";
  }

  return "DIA";
}

export function formatDrillingShift(value: string) {
  const option = drillingShiftOptions.find((item) => item.value === normalizeDrillingShift(value));
  return option?.label ?? "Dia";
}
