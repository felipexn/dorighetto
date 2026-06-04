import type { ReactNode } from "react";

export function PrivateValue({ children, mask = "R$ ******" }: { children: ReactNode; mask?: string }) {
  return (
    <span className="private-value">
      <span className="private-value-real">{children}</span>
      <span className="private-value-mask" aria-hidden="true">{mask}</span>
    </span>
  );
}
