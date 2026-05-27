export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC"
  }).format(value);
}

export function decimalToNumber(value: { toNumber: () => number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}
