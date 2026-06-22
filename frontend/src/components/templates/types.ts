/**
 * Unified data shape for all invoice template components.
 *
 * This same interface is used everywhere:
 *  - Settings preview → populated with MOCK data
 *  - Creation preview → populated from live form state
 *  - Saved invoice view → populated from backend fetch
 */

export interface InvoiceCompanyInfo {
  name: string;
  tagline?: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  pan?: string;
  gstin?: string;
  state?: string;
  logoUrl?: string;
}

export interface InvoicePartyInfo {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  placeOfSupply?: string;
}

export interface InvoiceLineItem {
  srNo: number;
  name: string;
  hsnSac?: string;
  quantity: number;
  uom?: string;
  inclusiveRate?: number;
  rate: number;
  discount?: number;
  taxableAmount: number;
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
}

export interface InvoiceBankDetails {
  bankName: string;
  branch: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
}

export interface InvoiceTaxBreakdownRow {
  taxRate: string;
  taxableValue: number;
  igstRate?: number;
  igstAmount?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  totalTax: number;
}

export type InvoiceType = "TAX INVOICE" | "PURCHASE INVOICE" | "DEBIT NOTE" | "CREDIT NOTE";

export interface InvoiceData {
  /** "TAX INVOICE", "PURCHASE INVOICE", etc. */
  type: InvoiceType;

  /** Invoice metadata */
  invoiceNumber: string;
  invoiceDate: string;
  challanNumber?: string;
  challanDate?: string;
  eWayBillNo?: string;
  transportName?: string;
  transportId?: string;

  /** Seller / firm info */
  company: InvoiceCompanyInfo;

  /** Buyer / customer / party info */
  party: InvoicePartyInfo;

  /** Line items */
  items: InvoiceLineItem[];

  /** Tax breakdown table */
  taxBreakdown: InvoiceTaxBreakdownRow[];

  /** Totals */
  subtotal: number;
  igstTotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  additionalLedgers?: { name: string; amount: number }[];
  grandTotal: number;
  totalInWords: string;
  totalTaxInWords?: string;

  /** Bank details for payment */
  bankDetails?: InvoiceBankDetails;

  /** Terms and conditions */
  termsAndConditions?: string[];

  /** Original/Duplicate/Triplicate */
  copyLabel?: string;

  /** Is the discount percentage or amount? */
  discountType?: "percentage" | "amount";
}

/** Props that every template component receives */
export interface TemplateProps {
  data: InvoiceData;
}

/** Registry entry describing one template option */
export interface TemplateRegistryEntry {
  id: string;
  name: string;
  description: string;
  component: React.ComponentType<TemplateProps>;
}
