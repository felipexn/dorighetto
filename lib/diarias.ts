export { parseDecimal } from "@/lib/form-validation";

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
