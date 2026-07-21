/**
 * Minimal dependency-free PDF generator for billing invoices.
 *
 * Produces a single-page A4 PDF with the standard Helvetica font. We keep the
 * content ASCII-only so string length equals byte length, which lets us compute
 * the xref byte offsets directly from the assembled document string.
 */

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  issuedOn: string;
  paidOn: string | null;
  organizationName: string;
  billingEmail: string | null;
  planName: string;
  interval: string;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  provider: string;
}

/** Escape characters that are special inside a PDF string literal. */
function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Strip anything non-ASCII so 1 char === 1 byte for offset math.
    .replace(/[^\x20-\x7e]/g, "?");
}

function formatMoney(cents: number, currency: string): string {
  return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
}

/** A single line of page text: content stream operators for one row. */
interface Line {
  text: string;
  size: number;
  bold?: boolean;
  gapBefore?: number;
}

export function buildInvoicePdf(data: InvoicePdfData): Buffer {
  const lines: Line[] = [
    { text: "INVOICE", size: 24, bold: true },
    { text: `Invoice #${data.invoiceNumber}`, size: 11, gapBefore: 14 },
    { text: `Status: ${data.status.toUpperCase()}`, size: 11, gapBefore: 4 },
    { text: `Issued: ${data.issuedOn}`, size: 11, gapBefore: 4 },
    ...(data.paidOn ? [{ text: `Paid: ${data.paidOn}`, size: 11, gapBefore: 4 }] : []),
    { text: "Billed to", size: 13, bold: true, gapBefore: 22 },
    { text: data.organizationName, size: 11, gapBefore: 6 },
    ...(data.billingEmail ? [{ text: data.billingEmail, size: 11, gapBefore: 4 }] : []),
    { text: "Summary", size: 13, bold: true, gapBefore: 22 },
    { text: `Plan: ${data.planName} (${data.interval})`, size: 11, gapBefore: 6 },
    { text: `Payment provider: ${data.provider}`, size: 11, gapBefore: 4 },
    {
      text: `Amount due: ${formatMoney(data.amountDueCents, data.currency)}`,
      size: 11,
      gapBefore: 4
    },
    {
      text: `Amount paid: ${formatMoney(data.amountPaidCents, data.currency)}`,
      size: 13,
      bold: true,
      gapBefore: 10
    },
    {
      text: "Thank you for your business.",
      size: 10,
      gapBefore: 40
    }
  ];

  // Build the content stream. Start near the top of an A4 page (842pt tall).
  let y = 800;
  const ops: string[] = ["BT", "/F1 12 Tf", "1 0 0 1 56 800 Tm"];
  let first = true;
  for (const line of lines) {
    const dy = -(line.gapBefore ?? 0) - line.size;
    if (first) {
      first = false;
    } else {
      y += dy;
      ops.push(`0 ${dy} Td`);
    }
    ops.push(`/${line.bold ? "F2" : "F1"} ${line.size} Tf`);
    ops.push(`(${pdfEscape(line.text)}) Tj`);
  }
  ops.push("ET");
  void y;
  const content = ops.join("\n");

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
