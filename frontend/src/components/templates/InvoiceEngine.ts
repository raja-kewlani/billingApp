/**
 * InvoiceEngine — Shared intelligence layer for invoice templates.
 *
 * Pure TypeScript. No React, no JSX, no DOM access.
 * Any template can import these functions to get:
 *   - Dynamic column detection
 *   - Auto-balanced column widths (3-bucket model)
 *   - Height-based page chunking
 *   - Centralized cell formatting
 *
 * Templates provide their own ChunkOptions (budgets, row height estimator)
 * so the engine stays accurate across different visual designs.
 */

import type { InvoiceData, InvoiceLineItem } from "./types";
import type {
  ColumnDef,
  ColumnFormat,
  ChunkOptions,
  PageChunk,
  PreparedInvoice,
} from "./engineTypes";

/* ═══════════════════════════════════════════════════
   1. DYNAMIC COLUMN DETECTION
   ═══════════════════════════════════════════════════ */

/**
 * Scans invoice data to determine which optional columns are active.
 *   Sr | Description | HSN* | Qty | Rate | Discount* | Taxable Amt | GST% | Amount
 * Uses parseFloat() for safety — form data may arrive as strings.
 */
export function detectColumns(data: InvoiceData): ColumnDef[] {
  const items = data.items;

  // Detect optional columns
  const hasHSN = items.some(
    (i) => i.hsnSac != null && String(i.hsnSac).trim() !== ""
  );
  const hasDiscount = items.some(
    (i) => i.discount != null && parseFloat(String(i.discount)) > 0
  );
  const hasInclusiveRate = items.some(
    (i) => i.inclusiveRate != null && parseFloat(String(i.inclusiveRate)) > 0
  );

  // Determine GST type: IGST (inter-state) vs CGST+SGST (intra-state)
  const isInterState = data.party?.state && data.company?.state && data.party.state.toLowerCase() !== data.company.state.toLowerCase();
  const hasIGST = (data.igstTotal != null && parseFloat(String(data.igstTotal)) > 0) || items.some(i => i.igstRate != null && parseFloat(String(i.igstRate)) > 0);

  // Build columns in canonical order
  const columns: ColumnDef[] = [
    {
      key: "srNo",
      label: "Sr.",
      width: "", // computed later
      align: "center",
      format: "integer",
      bucket: "fixed",
    },
    {
      key: "name",
      label: "Name of Product / Service",
      width: "",
      align: "left",
      format: "text",
      bucket: "flex",
    },
  ];

  if (hasHSN) {
    columns.push({
      key: "hsnSac",
      label: "HSN / SAC",
      width: "",
      align: "center",
      format: "text",
      bucket: "fixed",
    });
  }

  columns.push({
    key: "quantity",
    label: "Qty",
    width: "",
    align: "center",
    format: "text",
    bucket: "fixed",
    getValue: (item) => (item as any).isEmptyRow ? "" : `${item.quantity !== undefined ? item.quantity : ""} ${item.uom || ""}`.trim(),
  });

  if (hasInclusiveRate) {
    columns.push({
      key: "inclusiveRate",
      label: "Rate (Inc. Tax)",
      width: "",
      align: "right",
      format: "currency",
      bucket: "amount",
    });
  }

  columns.push({
    key: "rate",
    label: "Rate",
    width: "",
    align: "right",
    format: "currency",
    bucket: "amount",
  });

  if (hasDiscount) {
    const isPercentage = data.discountType === "percentage";
    columns.push({
      key: "discount",
      label: isPercentage ? "Discount (%)" : "Discount",
      width: "",
      align: "right",
      format: isPercentage ? "percent" : "currency",
      bucket: "amount",
    });
  }

  columns.push({
    key: "taxableAmount",
    label: "Taxable Value",
    width: "",
    align: "right",
    format: "currency",
    bucket: "amount",
  });

  // GST% column — show the applicable rate
  columns.push({
    key: "gstRate",
    label: hasIGST ? "IGST %" : "GST %",
    width: "",
    align: "center",
    format: "percent",
    bucket: "fixed",
    getValue: (item) => {
      if ((item as any).isEmptyRow) return undefined;
      if (hasIGST) return item.igstRate;
      // For CGST+SGST, show combined rate
      const cgst = parseFloat(String(item.cgstRate || 0));
      const sgst = parseFloat(String(item.sgstRate || 0));
      return cgst + sgst || undefined;
    },
  });

  // Final Amount = taxable + taxes
  columns.push({
    key: "lineTotal",
    label: "Amount",
    width: "",
    align: "right",
    format: "currency",
    bucket: "amount",
    getValue: (item) => {
      if ((item as any).isEmptyRow) return undefined;
      const taxable = item.taxableAmount || 0;
      const igst = parseFloat(String(item.igstAmount || 0));
      const cgst = parseFloat(String(item.cgstAmount || 0));
      const sgst = parseFloat(String(item.sgstAmount || 0));
      return taxable + igst + cgst + sgst;
    },
  });

  return columns;
}

/* ═══════════════════════════════════════════════════
   2. THREE-BUCKET COLUMN WIDTH CALCULATION
   ═══════════════════════════════════════════════════

   AMOUNT columns → Medium, hardcoded minimums (Rate, Discount, Taxable, Amount)
   FLEX columns   → Description gets whatever remains

   This produces a reasonable table at any column count (4 to 10+).
*/

const FIXED_WIDTHS: Record<string, number> = {
  srNo: 4,
  hsnSac: 8,
  quantity: 7,
  gstRate: 6,
};

const AMOUNT_WIDTHS: Record<string, number> = {
  inclusiveRate: 11,
  rate: 10,
  discount: 8,
  taxableAmount: 11,
  lineTotal: 11,
};

export function calcWidths(columns: ColumnDef[], data?: InvoiceData): ColumnDef[] {
  const maxLenMap: Record<string, number> = {};

  if (data) {
    for (const col of columns) {
      let maxLen = col.label.length;
      for (const item of data.items) {
        const val = getCellValue(item, col);
        const str = formatCell(val, col.format);
        if (str.length > maxLen) maxLen = str.length;
      }

      // Check totals for specific columns
      if (col.key === "taxableAmount" && data.subtotal != null) {
        const str = formatCell(data.subtotal, "currency");
        if (str.length > maxLen) maxLen = str.length;
      }
      if (col.key === "lineTotal" && data.grandTotal != null) {
        const str = formatCell(data.grandTotal, "currency");
        if (str.length + 3 > maxLen) maxLen = str.length + 3; // +3 for "₹ " and space
      }
      if (col.key === "quantity" && data.items.length > 0) {
        const totalQty = data.items.reduce((s, i) => s + (i.quantity || 0), 0);
        const str = `${totalQty} ${data.items[0]?.uom || ""}`.trim();
        if (str.length > maxLen) maxLen = str.length;
      }

      maxLenMap[col.key] = maxLen;
    }
  }

  let fixedTotal = 0;
  let amountTotal = 0;
  let flexCount = 0;

  const resolvedWidths: Record<string, number> = {};

  for (const col of columns) {
    if (col.bucket === "flex") {
      flexCount++;
      continue;
    }

    // Estimate width: ~1.1% per char + ~3.5% for padding
    const chars = maxLenMap[col.key] || 5;
    const dynamicWidth = data ? (chars * 1.1 + 3.5) : 0;

    let w = 10;
    if (col.bucket === "fixed" && FIXED_WIDTHS[col.key]) {
      w = Math.max(FIXED_WIDTHS[col.key], dynamicWidth);
      resolvedWidths[col.key] = w;
      fixedTotal += w;
    } else if (col.bucket === "amount" && AMOUNT_WIDTHS[col.key]) {
      w = Math.max(AMOUNT_WIDTHS[col.key], dynamicWidth);
      resolvedWidths[col.key] = w;
      amountTotal += w;
    } else {
      w = Math.max(10, dynamicWidth);
      resolvedWidths[col.key] = w;
      amountTotal += w;
    }
  }

  // Ensure we leave at least 15% for the flex column (Name of Product)
  const maxAllowedNonFlex = 85;
  let totalNonFlex = fixedTotal + amountTotal;

  // If non-flex columns exceed the max allowed, scale them down proportionally
  if (totalNonFlex > maxAllowedNonFlex) {
    const scale = maxAllowedNonFlex / totalNonFlex;
    fixedTotal = 0;
    amountTotal = 0;
    for (const col of columns) {
      if (col.bucket === "flex") continue;
      const scaledW = resolvedWidths[col.key] * scale;
      resolvedWidths[col.key] = scaledW;
      if (col.bucket === "fixed") fixedTotal += scaledW;
      else amountTotal += scaledW;
    }
  }

  const flexRemaining = Math.max(15, 100 - fixedTotal - amountTotal);
  const flexEach = flexRemaining / Math.max(1, flexCount);

  return columns.map((col) => {
    let w: number;
    if (col.bucket === "flex") {
      w = flexEach;
    } else {
      w = resolvedWidths[col.key];
    }
    // Round to 1 decimal place
    w = Math.round(w * 10) / 10;
    return { ...col, width: `${w}%` };
  });
}

/* ═══════════════════════════════════════════════════
   3. HEIGHT-BASED PAGE CHUNKING
   ═══════════════════════════════════════════════════ */

/** Default chunk options — sensible for the Classic template at 12.5px base */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  // Reduced to account for browser default margins
  page1Budget: 580,
  pageNBudget: 800,
  lastPageReserve: 500,
  rowHeight: (item: InvoiceLineItem) => {
    const nameLen = (item.name || "").length;
    if (nameLen > 150) return 85;
    if (nameLen > 90) return 68;
    if (nameLen > 45) return 48;
    return 33;
  },
};

export function chunkPages(
  data: InvoiceData,
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS
): PageChunk[] {
  const items = data.items;
  const chunks: InvoiceLineItem[][] = [];

  if (items.length === 0) {
    chunks.push([]);
  }
  let currentChunk: InvoiceLineItem[] = [];
  let currentHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < items.length; i++) {
    const rowH = options.rowHeight(items[i]);
    const budget = isFirstPage ? options.page1Budget : options.pageNBudget;

    const continuationReserve = options.rowHeight({ name: "" } as unknown as InvoiceLineItem) || 30;

    // Check if remaining items might be the last page — reserve footer space
    const remainingItems = items.slice(i);
    const remainingHeight = remainingItems.reduce(
      (sum, item) => sum + options.rowHeight(item),
      0
    );
    const isLikelyLastPage =
      currentHeight + remainingHeight + options.lastPageReserve <= budget;

    // If adding this row would exceed budget (accounting for last-page reserve
    // if this could be the last page), start a new page
    const effectiveBudget = isLikelyLastPage
      ? budget - options.lastPageReserve
      : budget - continuationReserve;

    if (currentHeight + rowH > effectiveBudget && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentHeight = 0;
      isFirstPage = false;
    }

    currentChunk.push(items[i]);
    currentHeight += rowH;
  }

  // Push final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Now verify the last chunk actually fits with the footer.
  // If not, we need to split it further.
  const lastChunkIdx = chunks.length - 1;
  if (lastChunkIdx > 0) {
    const lastBudget = options.pageNBudget - options.lastPageReserve;
    let lastHeight = 0;
    const lastItems = chunks[lastChunkIdx];
    const fitsInOnePage = lastItems.every((item) => {
      lastHeight += options.rowHeight(item);
      return lastHeight <= lastBudget;
    });

    if (!fitsInOnePage) {
      // Split the last chunk
      const overflow: InvoiceLineItem[] = [];
      const kept: InvoiceLineItem[] = [];
      let h = 0;
      for (const item of lastItems) {
        const rh = options.rowHeight(item);
        if (h + rh <= lastBudget) {
          kept.push(item);
          h += rh;
        } else {
          overflow.push(item);
        }
      }
      chunks[lastChunkIdx] = kept;
      if (overflow.length > 0) {
        chunks.push(overflow);
      }
    }
  }

  // --- ADAPTIVE EMPTY ROWS LOGIC ---
  const finalChunkIdx = chunks.length - 1;
  if (finalChunkIdx >= 0) {
    const finalBudget = (chunks.length === 1 ? options.page1Budget : options.pageNBudget) - options.lastPageReserve;
    const finalItems = chunks[finalChunkIdx];

    let finalHeight = finalItems.reduce((sum, item) => sum + options.rowHeight(item), 0);
    const remainingHeight = finalBudget - finalHeight;

    if (remainingHeight > 0) {
      // Inherit adaptive space from calculated items
      let adaptiveRowHeight = finalItems.length > 0
        ? finalHeight / finalItems.length
        : options.rowHeight({ name: "" } as unknown as InvoiceLineItem);

      if (adaptiveRowHeight > 0) {
        // Leave a 10px buffer to prevent boundary overflow due to subpixel rendering or borders
        const numEmptyRows = Math.floor(Math.max(0, remainingHeight - 10) / adaptiveRowHeight);

        for (let i = 0; i < numEmptyRows; i++) {
          finalItems.push({
            isEmptyRow: true,
            name: "",
            _adaptiveHeight: adaptiveRowHeight
          } as unknown as InvoiceLineItem);
        }
      }
    }
  }

  const totalPages = chunks.length;

  return chunks.map((chunkItems, idx) => ({
    items: chunkItems,
    pageNumber: idx + 1,
    totalPages,
    isFirstPage: idx === 0,
    isLastPage: idx === totalPages - 1,
    pageLabel: `Page ${idx + 1} of ${totalPages}`,
  }));
}

/* ═══════════════════════════════════════════════════
   4. CELL FORMATTING
   ═══════════════════════════════════════════════════ */

/**
 * Centralized cell formatter. Templates call this in their render loop
 * instead of implementing their own formatting logic.
 */
export function formatCell(
  value: string | number | undefined | null,
  format: ColumnFormat
): string {
  if (value == null || value === "") return "";

  switch (format) {
    case "currency": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(n)) return "";
      return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    case "percent": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(n) || n === 0) return "";
      return `${n}%`;
    }
    case "integer": {
      const n = typeof value === "string" ? parseInt(value, 10) : Math.floor(value as number);
      if (isNaN(n)) return "";
      return String(n);
    }
    case "decimal": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(n)) return "";
      return n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    case "text":
    default:
      return String(value);
  }
}

/**
 * Extracts the display value for a given column from a line item.
 * Uses the column's getValue() if defined, otherwise reads item[key].
 */
export function getCellValue(
  item: InvoiceLineItem,
  col: ColumnDef
): string | number | undefined {
  if (col.getValue) return col.getValue(item);
  return (item as unknown as Record<string, unknown>)[col.key] as
    | string
    | number
    | undefined;
}

/* ═══════════════════════════════════════════════════
   5. CONVENIENCE WRAPPER
   ═══════════════════════════════════════════════════ */

/**
 * One-call entry point for templates.
 *
 * Usage in a template:
 *   const prepared = prepareInvoice(data, myChunkOptions);
 *   // prepared.columns  → dynamic column definitions
 *   // prepared.pages    → height-budgeted page chunks
 *   // prepared.original → raw data for header/footer rendering
 */
export function prepareInvoice(
  data: InvoiceData,
  options?: ChunkOptions
): PreparedInvoice {
  const rawColumns = detectColumns(data);
  const columns = calcWidths(rawColumns, data);
  const pages = chunkPages(data, options);

  return { columns, pages, original: data };
}
