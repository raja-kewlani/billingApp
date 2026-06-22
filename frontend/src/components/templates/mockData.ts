import type { InvoiceData } from "./types";

/**
 * Realistic sample invoice data used in the Settings → bill-template preview.
 * Mirrors the Gujarat Freight Tools reference layout.
 */
export const MOCK_INVOICE_DATA: InvoiceData = {
  type: "TAX INVOICE",
  invoiceNumber: "GST-3425-26",
  invoiceDate: "23-Jul-2025",
  challanNumber: "33",
  challanDate: "23-Jul-2025",
  eWayBillNo: "78456378",
  transportName: "Silver Roadlines",
  transportId: "24ABSFS0321B2ZL",

  company: {
    name: "Gujarat Freight Tools",
    tagline: "Manufacturing & Supply of Precision Press Tool & Room Component",
    address: "Plot No A 64, Road No 21,\nWaghle Indl Estate,\nMumbai, Maharashtra - 400604",
    phone: "02225820309",
    email: "info@gft.com",
    website: "www.logobuld.com",
    pan: "26CORPP3939N1",
    gstin: "27CORPP3939N1ZA",
    state: "Maharashtra (27)",
  },

  party: {
    name: "Shiv Engineering",
    address: "Sumel Business Park 7, Kochi, Kerala - 380023",
    phone: "9878789878",
    gstin: "32AABBA7890B1ZB",
    state: "Kerala (32)",
    placeOfSupply: "Kerala (32)",
  },

  items: [
    {
      srNo: 1,
      name: "Bosch All-in-One Metal Hand Tool Kit",
      hsnSac: "8302",
      quantity: 1,
      uom: "NOS",
      inclusiveRate: 2991.3,
      rate: 2535.0,
      taxableAmount: 2535.0,
      igstRate: 18,
      igstAmount: 456.3,
    },
    {
      srNo: 2,
      name: "Taparia Universal Tool Kit",
      hsnSac: "8302",
      quantity: 1,
      uom: "NOS",
      rate: 1270.0,
      taxableAmount: 1270.0,
      igstRate: 18,
      igstAmount: 228.6,
    },
  ],

  taxBreakdown: [
    {
      taxRate: "18%",
      taxableValue: 3805.0,
      igstRate: 18,
      igstAmount: 684.9,
      totalTax: 684.9,
    },
  ],

  subtotal: 3805.0,
  igstTotal: 684.9,
  grandTotal: 4489.9,
  totalInWords: "FOUR THOUSAND FOUR HUNDRED AND NINETY RUPEES ONLY",
  totalTaxInWords: "SIX HUNDRED AND EIGHTY-FOUR RUPEES AND NINETY PAISA ONLY",
  copyLabel: "ORIGINAL FOR RECIPIENT",

  bankDetails: {
    bankName: "ICICI",
    branch: "Surat",
    accountNumber: "2715500356",
    ifsc: "ICIC045F",
    upiId: "ifox@icici",
  },

  termsAndConditions: [
    "Subject to Maharashtra Junction.",
    "Our Responsibility Ceases as soon as goods leaves our Premises.",
    "Goods once sold will not taken back.",
    "Delivery Ex-Premises.",
  ],
};
