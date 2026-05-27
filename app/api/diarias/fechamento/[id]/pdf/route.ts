import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Props) {
  const { id } = await params;
  const closure = await prisma.payrollClosure.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { date: "asc" }
      }
    }
  });

  if (!closure) {
    return new NextResponse("Fechamento nao encontrado.", { status: 404 });
  }

  const buffer = await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 44 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text("DORIGHETTO PERFURACAO", { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(14).text("RECIBO DE PAGAMENTO DE DIARIAS", { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Recibo: ${closure.receiptNumber}`);
    doc.text(`Funcionario: ${closure.employeeName}`);
    doc.text(`Funcao: ${closure.role}`);
    doc.text(`Periodo: ${formatDate(closure.periodStart)} a ${formatDate(closure.periodEnd)}`);
    doc.text(`Data do pagamento: ${formatDate(closure.paidAt)}`);
    doc.moveDown();

    doc.text("Data          Diaria       H.Extra    Vlr H.E.     Total H.E.    Total Dia");
    doc.moveTo(44, doc.y + 4).lineTo(550, doc.y + 4).stroke();
    doc.moveDown(0.8);

    for (const entry of closure.entries) {
      const line = [
        formatDate(entry.date).padEnd(13),
        formatCurrency(decimalToNumber(entry.dailyValue)).padEnd(13),
        `${decimalToNumber(entry.overtimeHours)}h`.padEnd(10),
        formatCurrency(decimalToNumber(entry.overtimeRate)).padEnd(12),
        formatCurrency(decimalToNumber(entry.overtimeTotal)).padEnd(13),
        formatCurrency(decimalToNumber(entry.dayTotal))
      ].join(" ");
      doc.text(line);
    }

    doc.moveDown();
    doc.fontSize(12).text(`Total de diarias: ${formatCurrency(decimalToNumber(closure.totalDaily))}`, { align: "right" });
    doc.text(`Total horas extras: ${formatCurrency(decimalToNumber(closure.totalOvertime))}`, { align: "right" });
    doc.fontSize(14).text(`Total geral recebido: ${formatCurrency(decimalToNumber(closure.totalPaid))}`, { align: "right" });

    doc.moveDown(2);
    doc.fontSize(11).text(
      "Declaro que recebi da empresa Dorighetto Perfuracao o valor acima referente as diarias trabalhadas no periodo informado."
    );

    doc.moveDown(3);
    doc.text("Local e data: ________________________________________________");
    doc.moveDown(2);
    doc.text("Assinatura do funcionario: ___________________________________");
    doc.moveDown(2);
    doc.text("Assinatura do responsavel: ___________________________________");

    doc.end();
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"recibo-${closure.receiptNumber}.pdf\"`
    }
  });
}
