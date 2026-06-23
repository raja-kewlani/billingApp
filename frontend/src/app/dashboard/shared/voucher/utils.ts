import { InvoiceLineState, TaxMode } from "./types";
import { ItemDetail } from "@/interfaces/inventory";

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function recalcLine(
  line: InvoiceLineState,
  item: ItemDetail | undefined,
  taxMode: TaxMode,
  discountType: "percentage" | "amount" = "percentage",
  rateInclusive: boolean = false
) {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price || 0);
  const grossAmount = quantity * unitPrice;

  let discountAmount = 0;
  let discountPercent = 0;

  if (discountType === "percentage") {
    discountPercent = Number(line.discount_percent || 0);
    discountAmount = round2(grossAmount * (discountPercent / 100));
  } else {
    discountAmount = Number(line.discount_amount || 0);
    discountPercent = grossAmount > 0 ? round2((discountAmount / grossAmount) * 100) : 0;
  }

  const taxable = round2(Math.max(grossAmount - discountAmount, 0));

  let igstRate = 0;
  let cgstRate = 0;
  let sgstRate = 0;

  if (item?.taxability === "Taxable") {
    if (taxMode === "inter") {
      igstRate = item.igst_rate;
    } else {
      cgstRate = item.cgst_rate;
      sgstRate = item.sgst_rate;
    }
  }

  const igstAmount = round2((taxable * igstRate) / 100);
  const cgstAmount = round2((taxable * cgstRate) / 100);
  const sgstAmount = round2((taxable * sgstRate) / 100);

  return {
    ...line,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    taxable_amount: taxable,
    igst_rate: igstRate,
    cgst_rate: cgstRate,
    sgst_rate: sgstRate,
    igst_amount: igstAmount,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
  };
}

/* ─────────────────────────────────────────────────
   Number to words — basic Indian-style converter
───────────────────────────────────────────────── */
export function numberToWords(num: number): string {
  if (num === 0) return "ZERO ONLY";

  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
    "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  function twoDigits(n: number): string {
    if (n >= 100) return "";
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigits(n: number): string {
    if (n === 0) return "";
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + " HUNDRED" + (n % 100 ? " AND " + twoDigits(n % 100) : "");
  }

  const numFixed = Math.round(num * 100) / 100;
  const rupees = Math.floor(numFixed);
  const paise = Math.round((numFixed - rupees) * 100);

  let result = "";
  if (rupees >= 10000000) {
    const crorePart = Math.floor(rupees / 10000000);
    result += (crorePart >= 100 ? threeDigits(crorePart) : twoDigits(crorePart)) + " CRORE ";
  }
  const afterCrore = rupees % 10000000;
  if (afterCrore >= 100000) {
    result += twoDigits(Math.floor(afterCrore / 100000)) + " LAKH ";
  }
  const afterLakh = afterCrore % 100000;
  if (afterLakh >= 1000) {
    result += twoDigits(Math.floor(afterLakh / 1000)) + " THOUSAND ";
  }
  const afterThousand = afterLakh % 1000;
  if (afterThousand > 0) {
    result += threeDigits(afterThousand);
  }

  result = result.trim();
  if (paise > 0) {
    result += " RUPEES AND " + twoDigits(paise) + " PAISE ONLY";
  } else {
    result += " RUPEES ONLY";
  }

  return result;
}
