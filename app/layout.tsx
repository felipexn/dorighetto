import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Dorighetto Perfuração",
  description: "Perfuração, controle operacional e gestão interna para serviços em mineração."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
