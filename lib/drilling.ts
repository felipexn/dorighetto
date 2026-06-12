export function normalizeDrillingBankName(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+(?=\d)/, "") || "0";
  }
  return trimmed;
}
