/**
 * pdfExport.ts
 * Professional Tally-style PDF generation for accounting ledgers and registers.
 * Uses jsPDF + jspdf-autotable for precise column layout, page-break running totals,
 * and "Carried Over / continued..." footers — exactly like the reference images.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — jspdf types ship with the package
import jsPDF from "jspdf";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — autoTable patches jsPDF prototype
import autoTable from "jspdf-autotable";

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */

export interface FirmInfo {
  name: string;
  mailingName?: string;
  address?: string;         // multi-line address string
  city?: string;
  state?: string;
  pincode?: string;
}

export interface LedgerStatementRow {
  voucher_date: string;
  category: string;
  particulars: string;
  voucher_number: string;
  debit_amount: number;
  credit_amount: number;
}

export interface LedgerStatementPdfOptions {
  firm: FirmInfo;
  ledgerName: string;
  ledgerSubtitle?: string;      // e.g. "B-58 SARDAR PATEL MALL NIKOL …"
  bookLabel?: string;           // e.g. "THE KARNAVATI CO-OP BANK  Book" or "Cash Book"
  fromDate?: string;
  toDate?: string;
  openingBalance: number;
  openingBalanceType: "Dr" | "Cr";
  closingBalance: number;
  closingBalanceType: "Dr" | "Cr";
  totalDebit: number;
  totalCredit: number;
  rows: LedgerStatementRow[];
  filename?: string;
}

export interface RegisterRow {
  voucher_date: string;
  voucher_number: string;
  category: string;
  party_name?: string | null;
  primary_ledger_name?: string | null;
  narration?: string | null;
  amount: number;
}

export interface RegisterPdfOptions {
  firm: FirmInfo;
  registerTitle: string;     // e.g. "Purchase Register"
  fromDate?: string;
  toDate?: string;
  rows: RegisterRow[];
  filename?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */

/** Format a date string (YYYY-MM-DD) → "1-Apr-2026" style (Tally format) */
function fmtDate(value: string): string {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  const day = d.getDate();
  const month = d.toLocaleString("en-IN", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Format a number with Indian comma notation, 2 decimal places */
function fmtAmt(value: number): string {
  if (!value || value === 0) return "";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

function fmtAmtFull(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

/** Build address lines array from firm info */
function buildAddressLines(firm: FirmInfo): string[] {
  const lines: string[] = [];
  if (firm.address) {
    // address may already be multi-line
    firm.address.split(/[\n,]+/).forEach((l) => {
      const t = l.trim();
      if (t) lines.push(t);
    });
  } else {
    if (firm.city) lines.push(firm.city);
    if (firm.state || firm.pincode)
      lines.push([firm.state, firm.pincode].filter(Boolean).join(", "));
  }
  return lines;
}

/** Draw the standard company + book header on a page, return Y position after header */
function drawHeader(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  firm: FirmInfo,
  bookLabel: string,
  bookSubtitle: string | undefined,
  dateRange: string,
): number {
  const cx = pageWidth / 2;
  let y = margin;

  // ── Company Name (bold, 12pt)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text((firm.mailingName || firm.name).toUpperCase(), cx, y, { align: "center" });
  y += 5;

  // ── Address lines (normal, 8pt)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const addrLines = buildAddressLines(firm);
  for (const line of addrLines) {
    doc.text(line, cx, y, { align: "center" });
    y += 4;
  }
  y += 2;

  // ── Underline under address
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(cx - 30, y, cx + 30, y);
  y += 5;

  // ── Book / Ledger label (bold, 11pt)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(bookLabel, cx, y, { align: "center" });
  y += 5;

  // ── Book subtitle e.g. bank address (normal, 8pt)
  if (bookSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const subLines = bookSubtitle.split("\n");
    for (const sl of subLines) {
      doc.text(sl.trim(), cx, y, { align: "center" });
      y += 4;
    }
  }
  y += 3;

  // ── Date range (normal, 8pt, centered)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(dateRange, cx, y, { align: "center" });
  y += 6;

  return y;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEDGER STATEMENT PDF  (Bank Book / Cash Book / Party Ledger)
   Columns: Date | Particulars | Vch Type | Vch No. | Debit | Credit
───────────────────────────────────────────────────────────────────────────── */

export function exportLedgerStatementPdf(opts: LedgerStatementPdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const bookLabel = opts.bookLabel ?? `${opts.ledgerName}  Book`;
  const dateRange =
    opts.fromDate && opts.toDate
      ? `${fmtDate(opts.fromDate)} to ${fmtDate(opts.toDate)}`
      : opts.fromDate
      ? `From ${fmtDate(opts.fromDate)}`
      : opts.toDate
      ? `Up to ${fmtDate(opts.toDate)}`
      : "";

  // ── Column widths (total = contentWidth ≈ 186mm for A4 with 12mm margins)
  // Date(18) | Particulars(60) | Vch Type(28) | Vch No.(22) | Debit(29) | Credit(29)
  const colWidths = [18, 60, 28, 22, 29, 29];

  // ── Build table body rows
  const tableBody: (string | { content: string; styles?: object })[][] = [];

  // Opening balance row
  tableBody.push([
    { content: fmtDate(opts.fromDate || ""), styles: { fontStyle: "normal" as const } },
    { content: "Opening Balance", styles: { fontStyle: "bold" as const } },
    "",
    "",
    opts.openingBalanceType === "Dr"
      ? { content: fmtAmtFull(opts.openingBalance), styles: { fontStyle: "bold" as const, halign: "right" as const } }
      : "",
    opts.openingBalanceType === "Cr"
      ? { content: fmtAmtFull(opts.openingBalance), styles: { fontStyle: "bold" as const, halign: "right" as const } }
      : "",
  ]);

  // Data rows — group by date for Tally-style rendering
  let lastDate = "";
  for (const row of opts.rows) {
    const dateStr = row.voucher_date ? fmtDate(row.voucher_date) : "";
    const showDate = dateStr !== lastDate;
    if (showDate) lastDate = dateStr;

    const prefix = row.debit_amount > 0 ? "To" : "By";
    const particulars = `${prefix} ${row.particulars}`;

    tableBody.push([
      showDate ? dateStr : "",
      particulars,
      row.category || "",
      row.voucher_number || "",
      row.debit_amount > 0
        ? { content: fmtAmt(row.debit_amount), styles: { halign: "right" as const } }
        : "",
      row.credit_amount > 0
        ? { content: fmtAmt(row.credit_amount), styles: { halign: "right" as const } }
        : "",
    ]);
  }

  // Totals rows
  tableBody.push([
    "",
    "",
    "",
    "",
    { content: fmtAmtFull(opts.totalDebit), styles: { fontStyle: "bold" as const, halign: "right" as const, lineWidth: { top: 0.3 } as unknown as number } },
    { content: fmtAmtFull(opts.totalCredit), styles: { fontStyle: "bold" as const, halign: "right" as const, lineWidth: { top: 0.3 } as unknown as number } },
  ]);

  // Closing balance row
  const cbLabel = opts.closingBalanceType === "Dr" ? "To  Closing Balance" : "By  Closing Balance";
  tableBody.push([
    "",
    { content: cbLabel, styles: { fontStyle: "bold" as const } },
    "",
    "",
    opts.closingBalanceType === "Dr"
      ? { content: fmtAmtFull(opts.closingBalance), styles: { fontStyle: "bold" as const, halign: "right" as const } }
      : "",
    opts.closingBalanceType === "Cr"
      ? { content: fmtAmtFull(opts.closingBalance), styles: { fontStyle: "bold" as const, halign: "right" as const } }
      : "",
  ]);

  // Grand total row (balancing row)
  tableBody.push([
    "",
    "",
    "",
    "",
    { content: fmtAmtFull(opts.totalDebit + (opts.closingBalanceType === "Cr" ? opts.closingBalance : 0)), styles: { fontStyle: "bold" as const, halign: "right" as const } },
    { content: fmtAmtFull(opts.totalCredit + (opts.closingBalanceType === "Dr" ? opts.closingBalance : 0)), styles: { fontStyle: "bold" as const, halign: "right" as const } },
  ]);

  let pageCount = 0;

  autoTable(doc, {
    startY: drawHeader(doc, pageWidth, margin, opts.firm, bookLabel, opts.ledgerSubtitle, dateRange),
    head: [[
      { content: "Date", styles: { halign: "left" as const } },
      { content: "Particulars", styles: { halign: "left" as const } },
      { content: "Vch Type", styles: { halign: "left" as const } },
      { content: "Vch No.", styles: { halign: "left" as const } },
      { content: "Debit", styles: { halign: "right" as const } },
      { content: "Credit", styles: { halign: "right" as const } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: colWidths[0], fontStyle: "normal", fontSize: 7.5 },
      1: { cellWidth: colWidths[1], fontStyle: "normal", fontSize: 7.5 },
      2: { cellWidth: colWidths[2], fontStyle: "normal", fontSize: 7.5 },
      3: { cellWidth: colWidths[3], fontStyle: "normal", fontSize: 7.5, halign: "left" },
      4: { cellWidth: colWidths[4], fontStyle: "normal", fontSize: 7.5, halign: "right" },
      5: { cellWidth: colWidths[5], fontStyle: "normal", fontSize: 7.5, halign: "right" },
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: { bottom: 0.3, top: 0.3 } as unknown as number,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      lineWidth: 0,
      lineColor: [200, 200, 200],
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0,
    margin: { left: margin, right: margin },
    theme: "plain",
    showHead: "everyPage",

    // ── Page break hooks: "Carried Over" footer + new page header
    didDrawPage: (data) => {
      pageCount++;
      const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages?.() ?? pageCount;

      // "Page N" top-right
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Page ${pageCount}`, pageWidth - margin, margin - 2, { align: "right" });

      // "Carried Over" / "continued..." at page bottom (not on last page)
      const isLastPage = data.pageNumber === totalPages;
      if (!isLastPage) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.text("Carried Over", margin + 4, pageHeight - 8);
        doc.text("continued ...", pageWidth - margin, pageHeight - 8, { align: "right" });
      }
    },

    // Redraw header on each new page
    didParseCell: () => {},
  });

  // ── Draw horizontal rules above the header row on each page (done via headStyles lineWidth)

  const filename = opts.filename || `${opts.ledgerName.replace(/[^A-Za-z0-9]/g, "_")}_statement.pdf`;
  doc.save(filename);
}

/* ─────────────────────────────────────────────────────────────────────────────
   REGISTER PDF  (Purchase Register / Day Book / etc.)
   Columns: Date | Voucher No. | Category | Party / Ledger | Narration | Amount
───────────────────────────────────────────────────────────────────────────── */

export function exportRegisterPdf(opts: RegisterPdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const dateRange =
    opts.fromDate && opts.toDate
      ? `${fmtDate(opts.fromDate)} to ${fmtDate(opts.toDate)}`
      : opts.fromDate
      ? `From ${fmtDate(opts.fromDate)}`
      : opts.toDate
      ? `Up to ${fmtDate(opts.toDate)}`
      : "";

  // Columns: Date(18) | Vch No.(30) | Vch Type(25) | Party/Ledger(55) | Narration(40) | Amount(25)
  const colWidths = [18, 30, 25, 48, 40, 26];

  const tableBody: (string | { content: string; styles?: object })[][] = [];

  let grandTotal = 0;
  for (const row of opts.rows) {
    grandTotal += row.amount || 0;
    const party = row.party_name || row.primary_ledger_name || "";
    tableBody.push([
      fmtDate(row.voucher_date),
      row.voucher_number || "",
      row.category || "",
      party,
      row.narration || "",
      { content: fmtAmt(row.amount), styles: { halign: "right" as const } },
    ]);
  }

  // Grand total row
  if (tableBody.length > 0) {
    tableBody.push([
      "",
      "",
      "",
      "",
      { content: "Total", styles: { fontStyle: "bold" as const, halign: "right" as const } },
      { content: fmtAmtFull(grandTotal), styles: { fontStyle: "bold" as const, halign: "right" as const } },
    ]);
  }

  let pageCount = 0;

  autoTable(doc, {
    startY: drawHeader(doc, pageWidth, margin, opts.firm, opts.registerTitle, undefined, dateRange),
    head: [[
      { content: "Date", styles: { halign: "left" as const } },
      { content: "Vch No.", styles: { halign: "left" as const } },
      { content: "Vch Type", styles: { halign: "left" as const } },
      { content: "Party / Ledger", styles: { halign: "left" as const } },
      { content: "Narration", styles: { halign: "left" as const } },
      { content: "Amount", styles: { halign: "right" as const } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: colWidths[0], fontSize: 7.5 },
      1: { cellWidth: colWidths[1], fontSize: 7.5 },
      2: { cellWidth: colWidths[2], fontSize: 7.5 },
      3: { cellWidth: colWidths[3], fontSize: 7.5 },
      4: { cellWidth: colWidths[4], fontSize: 7.5 },
      5: { cellWidth: colWidths[5], fontSize: 7.5, halign: "right" },
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: { bottom: 0.3, top: 0.3 } as unknown as number,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: margin, right: margin },
    theme: "plain",
    showHead: "everyPage",

    didDrawPage: (data) => {
      pageCount++;
      const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages?.() ?? pageCount;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Page ${pageCount}`, pageWidth - margin, margin - 2, { align: "right" });

      const isLastPage = data.pageNumber === totalPages;
      if (!isLastPage) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.text("Carried Over", margin + 4, pageHeight - 8);
        doc.text("continued ...", pageWidth - margin, pageHeight - 8, { align: "right" });
      }
    },
  });

  const filename = opts.filename || `${opts.registerTitle.replace(/[^A-Za-z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
