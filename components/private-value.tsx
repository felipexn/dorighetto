import type { ReactNode } from "react";

export function PrivateValue({ children, mask = "R$ ******" }: { children: ReactNode; mask?: string }) {
  return (
    <span className="private-value" data-private-mask={mask}>
      {children}
    </span>
  );
}
