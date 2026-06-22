import path from "node:path";
import { NextResponse } from "next/server";
import { decimalToNumber, formatCurrency, formatDate } from "@/lib/format";
import { requireModule } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type PdfDoc = PDFKit.PDFDocument;

const PAGE = {
  margin: 42,
  width: 595.28,
  height: 841.89
};

const COLOR = {
  ink: "#171714",
  muted: "#666257",
  line: "#d7d0c1",
  softLine: "#e7e1d7",
  paper: "#ffffff",
  panel: "#f4f0e8",
  accent: "#a97000"
};

function drawRoundedRect(doc: PdfDoc, x: number, y: number, w: number, h: number, fill: string, stroke = COLOR.line) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(fill, stroke);
}

function text(doc: PdfDoc, value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(value, x, y, { lineGap: 2, ...options });
}

function drawInfoCard(doc: PdfDoc, label: string, value: string, x: number, y: number, w: number, h = 48) {
  drawRoundedRect(doc, x, y, w, h, COLOR.paper);
  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(8);
  text(doc, label.toUpperCase(), x + 10, y + 9, { width: w - 20 });
  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(10);
  text(doc, value, x + 10, y + 25, { width: w - 20, height: 16 });
}

function drawTableHeader(doc: PdfDoc, x: number, y: number, widths: number[]) {
  const labels = ["Data", "Diária", "H. extra", "Valor H.E.", "Total H.E.", "Total dia"];
  drawRoundedRect(doc, x, y, widths.reduce((sum, width) => sum + width, 0), 30, COLOR.panel);
  doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8);

  let cursor = x;
  labels.forEach((label, index) => {
    text(doc, label, cursor + 7, y + 10, {
      width: widths[index] - 14,
      align: index === labels.length - 1 ? "right" : "left"
    });
    cursor += widths[index];
  });
}

function drawTableRow(doc: PdfDoc, values: string[], x: number, y: number, widths: number[], shaded: boolean) {
  const rowWidth = widths.reduce((sum, width) => sum + width, 0);
  doc.rect(x, y, rowWidth, 28).fillAndStroke(shaded ? "#fbfaf7" : COLOR.paper, COLOR.softLine);
  doc.fillColor(COLOR.ink).font("Helvetica").fontSize(8.4);

  let cursor = x;
  values.forEach((value, index) => {
    const isTotal = index === values.length - 1;
    doc.font(isTotal ? "Helvetica-Bold" : "Helvetica");
    text(doc, value, cursor + 7, y + 9, {
      width: widths[index] - 14,
      align: isTotal || index > 0 ? "right" : "left"
    });
    cursor += widths[index];
  });
}

function drawSignatureLine(doc: PdfDoc, label: string, x: number, y: number, w: number) {
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(1).strokeColor(COLOR.ink).stroke();
  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(9);
  text(doc, label, x, y + 8, { width: w, align: "center" });
}

function drawHeader(doc: PdfDoc, closure: { receiptNumber: string }) {
  const logoPath = path.join(process.cwd(), "public", "logo-dorighetto.jpeg");
  const x = PAGE.margin;
  const y = PAGE.margin;
  const contentWidth = PAGE.width - PAGE.margin * 2;

  doc.image(logoPath, x, y, { fit: [64, 64], align: "center", valign: "center" });
  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(18);
  text(doc, "DORIGHETTO PERFURAÇÃO", x + 82, y + 10, { width: 300 });
  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(10);
  text(doc, "Recibo de pagamento de diárias", x + 82, y + 35, { width: 300 });

  drawRoundedRect(doc, x + contentWidth - 128, y + 13, 128, 38, COLOR.panel, COLOR.line);
  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(8);
  text(doc, "RECIBO", x + contentWidth - 116, y + 21, { width: 104, align: "center" });
  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(10);
  text(doc, closure.receiptNumber, x + contentWidth - 116, y + 34, { width: 104, align: "center" });

  doc.moveTo(x, y + 82).lineTo(x + contentWidth, y + 82).lineWidth(1.5).strokeColor(COLOR.ink).stroke();
}

export async function GET(_: Request, { params }: Props) {
  await requireModule("diarias");
  const { prisma } = await import("@/lib/prisma");
  const { ensurePayrollSchema } = await import("@/lib/payroll-schema");
  const PDFDocument = (await import("pdfkit")).default;
  const { id } = await params;

  await ensurePayrollSchema(prisma);

  const closure = await prisma.payrollClosure.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { date: "asc" }
      },
      advances: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!closure) {
    return new NextResponse("Fechamento não encontrado.", { status: 404 });
  }

  const buffer = await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    const contentX = PAGE.margin;
    const contentWidth = PAGE.width - PAGE.margin * 2;
    const tableWidths = [70, 86, 68, 86, 86, 108];
    let y = PAGE.margin;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawHeader(doc, closure);
    y += 110;

    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(20);
    text(doc, "RECIBO DE PAGAMENTO", contentX, y, { width: contentWidth, align: "center" });
    y += 30;
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(10);
    text(
      doc,
      "Declaro que recebi da empresa Dorighetto Perfuração o valor líquido referente às diárias trabalhadas no período informado abaixo.",
      contentX + 46,
      y,
      { width: contentWidth - 92, align: "center" }
    );
    y += 48;

    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    drawInfoCard(doc, "Funcionário", closure.employeeName, contentX, y, cardWidth);
    drawInfoCard(doc, "Função", closure.role, contentX + cardWidth + cardGap, y, cardWidth);
    drawInfoCard(doc, "Período", `${formatDate(closure.periodStart)} a ${formatDate(closure.periodEnd)}`, contentX + (cardWidth + cardGap) * 2, y, cardWidth);
    y += 58;
    drawInfoCard(doc, "Data do pagamento", formatDate(closure.paidAt), contentX, y, cardWidth);
    drawInfoCard(doc, "Dias trabalhados", String(closure.daysWorked), contentX + cardWidth + cardGap, y, cardWidth);
    drawInfoCard(doc, "Status do recibo", "PAGO", contentX + (cardWidth + cardGap) * 2, y, cardWidth);
    y += 72;

    drawTableHeader(doc, contentX, y, tableWidths);
    y += 30;

    closure.entries.forEach((entry, index) => {
      if (y > PAGE.height - 205) {
        doc.addPage({ margin: 0 });
        y = PAGE.margin;
        drawTableHeader(doc, contentX, y, tableWidths);
        y += 30;
      }

      drawTableRow(
        doc,
        [
          formatDate(entry.date),
          formatCurrency(decimalToNumber(entry.dailyValue)),
          `${decimalToNumber(entry.overtimeHours).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}h`,
          formatCurrency(decimalToNumber(entry.overtimeRate)),
          formatCurrency(decimalToNumber(entry.overtimeTotal)),
          formatCurrency(decimalToNumber(entry.dayTotal))
        ],
        contentX,
        y,
        tableWidths,
        index % 2 === 1
      );
      y += 28;
    });

    y += 18;
    if (closure.advances.length > 0) {
      const advanceBoxHeight = 36 + closure.advances.length * 24;
      if (y > PAGE.height - advanceBoxHeight - 155) {
        doc.addPage({ margin: 0 });
        y = PAGE.margin;
      }

      drawRoundedRect(doc, contentX, y, contentWidth, advanceBoxHeight, COLOR.paper);
      doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(10);
      text(doc, "VALES DESCONTADOS", contentX + 12, y + 12, { width: contentWidth - 24 });

      closure.advances.forEach((advance, index) => {
        const rowY = y + 36 + index * 24;
        doc.moveTo(contentX, rowY).lineTo(contentX + contentWidth, rowY).lineWidth(1).strokeColor(COLOR.softLine).stroke();
        doc.fillColor(COLOR.muted).font("Helvetica").fontSize(9);
        text(doc, advance.notes, contentX + 12, rowY + 7, { width: contentWidth - 150 });
        doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9);
        text(doc, formatCurrency(decimalToNumber(advance.amount)), contentX + contentWidth - 132, rowY + 7, { width: 120, align: "right" });
      });

      y += advanceBoxHeight + 18;
    }

    const totalBoxWidth = 265;
    const totalBoxX = contentX + contentWidth - totalBoxWidth;
    const totalRows = [
      ["Total de diárias", formatCurrency(decimalToNumber(closure.totalDaily))],
      ["Total horas extras", formatCurrency(decimalToNumber(closure.totalOvertime))],
      ["Total bruto", formatCurrency(decimalToNumber(closure.totalDaily.add(closure.totalOvertime)))],
      ["Vales descontados", `- ${formatCurrency(decimalToNumber(closure.totalAdvance))}`],
      ["Total líquido recebido", formatCurrency(decimalToNumber(closure.totalPaid))]
    ];
    const totalBoxHeight = totalRows.length * 30 + 2;
    if (y > PAGE.height - totalBoxHeight - 155) {
      doc.addPage({ margin: 0 });
      y = PAGE.margin;
    }
    drawRoundedRect(doc, totalBoxX, y, totalBoxWidth, totalBoxHeight, COLOR.paper);

    totalRows.forEach(([label, value], index) => {
      const rowY = y + index * 30;
      const isGrandTotal = index === totalRows.length - 1;
      if (isGrandTotal) {
        doc.rect(totalBoxX, rowY, totalBoxWidth, 32).fill(COLOR.panel);
      }
      if (index > 0) {
        doc.moveTo(totalBoxX, rowY).lineTo(totalBoxX + totalBoxWidth, rowY).lineWidth(1).strokeColor(COLOR.softLine).stroke();
      }
      doc.fillColor(COLOR.muted).font("Helvetica").fontSize(9);
      text(doc, label, totalBoxX + 12, rowY + 10, { width: 128 });
      doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(isGrandTotal ? 11 : 10);
      text(doc, value, totalBoxX + 138, rowY + 10, { width: 112, align: "right" });
    });
    y += totalRows.length * 30 + 32;

    if (y > PAGE.height - 150) {
      doc.addPage({ margin: 0 });
      y = PAGE.margin;
    }

    doc.fillColor(COLOR.ink).font("Helvetica").fontSize(10.5);
    text(
      doc,
      `Eu, ${closure.employeeName}, declaro para os devidos fins que recebi o valor líquido acima descrito, referente aos dias trabalhados no período informado, já descontados os vales listados neste recibo quando houver.`,
      contentX,
      y,
      { width: contentWidth, align: "justify" }
    );
    y += 86;

    drawSignatureLine(doc, "Local e data", contentX, y, 210);
    drawSignatureLine(doc, "Assinatura do funcionário", contentX + 292, y, 210);
    y += 62;
    drawSignatureLine(doc, "Assinatura do responsável", contentX + 146, y, 210);

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor(COLOR.muted).font("Helvetica").fontSize(8);
      text(doc, `Página ${i + 1} de ${pageRange.count}`, PAGE.margin, PAGE.height - 28, {
        width: contentWidth,
        align: "right"
      });
    }

    doc.end();
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"recibo-${closure.receiptNumber}.pdf\"`
    }
  });
}

