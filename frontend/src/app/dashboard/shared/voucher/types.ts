import { VoucherCategory, BillRefType } from "@/interfaces/voucher";
import { DrCrType } from "@/interfaces/ledger";

export type VoucherSlug =
  | "sales-invoice"
  | "purchase-invoice"
  | "receipt"
  | "payment"
  | "debit-note"
  | "credit-note"
  | "journal-entry"
  | "contra-entry";

export type VoucherFamily = "invoice" | "payment" | "journal" | "contra";
export type TaxMode = "intra" | "inter";

export type VoucherMeta = {
  category: VoucherCategory;
  family: VoucherFamily;
  title: string;
  description: string;
};

export type InvoiceLineState = {
  item_id: string;
  quantity: number;
  unit_price: number;
  inclusive_rate?: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  igst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
};

export type JournalLineState = {
  ledger_id: string;
  debit_amount: number;
  credit_amount: number;
};

export type AdditionalLedgerState = {
  ledger_id: string;
  amount: number; // positive means it adds to invoice (like rounding up), negative means discount (reduces invoice)
  is_manual?: boolean;
};

export type BillAllocationState = {
  ref_type: BillRefType;
  ref_name: string;
  amount: number;
  amount_type: DrCrType;
  due_date: string;
};

export type FormState = {
  voucher_number: string;
  voucher_date: string;
  narration: string;
  party_ledger_id: string;
  main_ledger_id: string;
  cash_bank_ledger_id: string;
  source_ledger_id: string;
  destination_ledger_id: string;
  amount: number;
  manual_tax_mode: TaxMode;
  additional_ledgers: AdditionalLedgerState[];
  bill_allocations: BillAllocationState[];
  discount_type: "percentage" | "amount";
  original_invoice_number: string;
  original_invoice_date: string;
};

export const VOUCHER_META: Record<VoucherSlug, VoucherMeta> = {
  "sales-invoice": {
    category: "Sales",
    family: "invoice",
    title: "Sales Invoice",
    description: "Party, sales ledger, tax ledgers, and inventory lines stay in one focused invoice workflow.",
  },
  "purchase-invoice": {
    category: "Purchase",
    family: "invoice",
    title: "Purchase Invoice",
    description: "Capture inward goods or services without losing the accounting-side ledger structure.",
  },
  receipt: {
    category: "Receipt",
    family: "payment",
    title: "Receipt Voucher",
    description: "Keep party, cash or bank, amount, date, and narration tight and fast.",
  },
  payment: {
    category: "Payment",
    family: "payment",
    title: "Payment Voucher",
    description: "Move money out with a cleaner, two-ledger flow instead of a bloated invoice screen.",
  },
  "debit-note": {
    category: "Debit Note",
    family: "invoice",
    title: "Debit Note",
    description: "Inventory-backed debit note workflow with separate invoice logic and tax handling.",
  },
  "credit-note": {
    category: "Credit Note",
    family: "invoice",
    title: "Credit Note",
    description: "Bring returns or reversals into the same invoice-grade workflow without turning it into a monster form.",
  },
  "journal-entry": {
    category: "Journal",
    family: "journal",
    title: "Journal Entry",
    description: "Free-form accounting lines for cases that should not pretend to be invoices or payments.",
  },
  "contra-entry": {
    category: "Contra",
    family: "contra",
    title: "Contra Entry",
    description: "A focused two-ledger money movement flow for cash and bank transfers.",
  },
};

export const getDefaultDate = (fromDate: string, toDate: string) => {
  const today = new Date().toISOString().slice(0, 10);
  if (fromDate && today < fromDate) return fromDate;
  if (toDate && today > toDate) return toDate;
  return today;
};

export const getEmptyForm = (fromDate: string, toDate: string): FormState => ({
  voucher_number: "",
  voucher_date: getDefaultDate(fromDate, toDate),
  narration: "",
  party_ledger_id: "",
  main_ledger_id: "",
  cash_bank_ledger_id: "",
  source_ledger_id: "",
  destination_ledger_id: "",
  amount: 0,
  manual_tax_mode: "intra",
  additional_ledgers: [],
  bill_allocations: [],
  original_invoice_number: "",
  original_invoice_date: "",
  discount_type: "percentage",
});

export const EMPTY_INVOICE_LINE: InvoiceLineState = {
  item_id: "",
  quantity: 0,
  unit_price: 0,
  discount_percent: 0,
  discount_amount: 0,
  taxable_amount: 0,
  igst_rate: 0,
  cgst_rate: 0,
  sgst_rate: 0,
  igst_amount: 0,
  cgst_amount: 0,
  sgst_amount: 0,
};

export const EMPTY_JOURNAL_LINE: JournalLineState = {
  ledger_id: "",
  debit_amount: 0,
  credit_amount: 0,
};

export const EMPTY_ADDITIONAL_LEDGER: AdditionalLedgerState = {
  ledger_id: "",
  amount: 0,
  is_manual: false,
};
