import { LedgerDetail } from "@/interfaces/ledger";
import { VoucherCategory, VoucherWritePayload } from "@/interfaces/voucher";
import { FormState, InvoiceLineState, JournalLineState, VoucherFamily } from "./types";
import { isTaxLedger } from "./hooks/useVoucherData";

type InvoiceTotals = {
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
};

type BuildPayloadParams = {
  activeFirmId: string;
  form: FormState;
  family: VoucherFamily;
  category: VoucherCategory;
  invoiceLines: InvoiceLineState[];
  invoiceTotals: InvoiceTotals;
  journalLines: JournalLineState[];
  ledgers: LedgerDetail[];
  firmState: string;
};

function requireSelection(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Select ${label} before saving the voucher`);
  }
  return trimmed;
}

function requireLines<T>(lines: T[], label: string): void {
  if (lines.length === 0) {
    throw new Error(`Add at least one ${label}`);
  }
}

export function buildVoucherPayload({
  activeFirmId,
  form,
  family,
  category,
  invoiceLines,
  invoiceTotals,
  journalLines,
  ledgers,
  firmState,
}: BuildPayloadParams): VoucherWritePayload {
  const voucherNumber = requireSelection(form.voucher_number, "voucher number");

  if (family === "invoice") {
    const partyLedgerId = requireSelection(form.party_ledger_id, "party ledger");

    const isSalesType = category === "Sales" || category === "Credit Note";
    const targetName = isSalesType ? "Sales" : "Purchase";
    const targetGroup = isSalesType ? "Sales Accounts" : "Purchase Accounts";
    
    let mainLedgerId = form.main_ledger_id;
    if (!mainLedgerId) {
      const defaultLedger = ledgers.find((l) => l.name === targetName && l.group_name === targetGroup) || ledgers.find((l) => l.name === targetName);
      if (defaultLedger) {
        mainLedgerId = defaultLedger.id;
      } else {
        throw new Error(`Could not automatically find the default ${targetName} ledger. Please ensure it exists.`);
      }
    }

    const finalInvoiceLines = invoiceLines.filter((line) => {
      const isPristine =
        !line.item_id &&
        (line.quantity === 1 || !line.quantity) &&
        !line.unit_price &&
        !line.discount_amount;
      return !isPristine;
    });

    requireLines(finalInvoiceLines, "invoice line");

    const partyLedger = ledgers.find((l) => l.id === partyLedgerId);
    if (!partyLedger) throw new Error("Party ledger not found");

    const partyState = partyLedger.party_details?.state?.trim().toLowerCase();
    const normalizedFirmState = firmState?.trim().toLowerCase();

    if (!normalizedFirmState) {
      throw new Error(
        "Your firm is missing a State. Please update your firm profile with a state to determine tax.",
      );
    }
    if (!partyState && !partyLedger.name.toLowerCase().includes("cash")) {
      throw new Error(
        `The party ledger '${partyLedger.name}' is missing a State. Please update the party ledger with a state to determine tax (IGST vs CGST/SGST).`,
      );
    }

    const getTaxLedgerId = (type: string): string => {
      const aliases: Record<string, string[]> = {
        igst: ["igst", "inter", "integrated"],
        cgst: ["cgst", "central"],
        sgst: ["sgst", "state", "utgst"],
      };
      const searchTerms = aliases[type.toLowerCase()] || [type.toLowerCase()];
      const found = ledgers.find(
        (l) => isTaxLedger(l) && searchTerms.some((term) => l.name.toLowerCase().includes(term)),
      );
      if (!found)
        throw new Error(
          `Could not automatically find tax ledger for ${type.toUpperCase()}. Please create a tax ledger containing '${searchTerms.join("' or '")}' in its name.`,
        );
      return found.id;
    };

    for (const [index, line] of finalInvoiceLines.entries()) {
      requireSelection(line.item_id, `item on line ${index + 1}`);
      if (!line.quantity || line.quantity <= 0) {
        throw new Error(`Enter a valid quantity on line ${index + 1}`);
      }
    }

    const accountingLines: {
      ledger_id: string;
      line_number: number;
      debit_amount: number;
      credit_amount: number;
    }[] = [];

    const totalAdditionalAmount = form.additional_ledgers?.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) || 0;
    const finalGrandTotal = invoiceTotals.grandTotal + totalAdditionalAmount;

    if (category === "Sales" || category === "Debit Note") {
      accountingLines.push({
        ledger_id: partyLedgerId,
        line_number: 1,
        debit_amount: finalGrandTotal,
        credit_amount: 0,
      });
      accountingLines.push({
        ledger_id: mainLedgerId,
        line_number: 2,
        debit_amount: 0,
        credit_amount: invoiceTotals.taxable,
      });
      let lineNumber = 3;
      if (invoiceTotals.igst > 0) {
        accountingLines.push({
          ledger_id: getTaxLedgerId("igst"),
          line_number: lineNumber++,
          debit_amount: 0,
          credit_amount: invoiceTotals.igst,
        });
      } else {
        if (invoiceTotals.cgst > 0) {
          accountingLines.push({
            ledger_id: getTaxLedgerId("cgst"),
            line_number: lineNumber++,
            debit_amount: 0,
            credit_amount: invoiceTotals.cgst,
          });
        }
        if (invoiceTotals.sgst > 0) {
          accountingLines.push({
            ledger_id: getTaxLedgerId("sgst"),
            line_number: lineNumber++,
            debit_amount: 0,
            credit_amount: invoiceTotals.sgst,
          });
        }
      }

      if (form.additional_ledgers) {
        for (const al of form.additional_ledgers) {
          if (!al.ledger_id || !al.amount) continue;
          accountingLines.push({
            ledger_id: al.ledger_id,
            line_number: lineNumber++,
            debit_amount: al.amount < 0 ? Math.abs(al.amount) : 0,
            credit_amount: al.amount > 0 ? al.amount : 0,
          });
        }
      }
    } else {
      // Purchase / Credit Note — debit the purchase/expense ledger
      accountingLines.push({
        ledger_id: mainLedgerId,
        line_number: 1,
        debit_amount: invoiceTotals.taxable,
        credit_amount: 0,
      });
      let lineNumber = 2;
      if (invoiceTotals.igst > 0) {
        accountingLines.push({
          ledger_id: getTaxLedgerId("igst"),
          line_number: lineNumber++,
          debit_amount: invoiceTotals.igst,
          credit_amount: 0,
        });
      } else {
        if (invoiceTotals.cgst > 0) {
          accountingLines.push({
            ledger_id: getTaxLedgerId("cgst"),
            line_number: lineNumber++,
            debit_amount: invoiceTotals.cgst,
            credit_amount: 0,
          });
        }
        if (invoiceTotals.sgst > 0) {
          accountingLines.push({
            ledger_id: getTaxLedgerId("sgst"),
            line_number: lineNumber++,
            debit_amount: invoiceTotals.sgst,
            credit_amount: 0,
          });
        }
      }

      if (form.additional_ledgers) {
        for (const al of form.additional_ledgers) {
          if (!al.ledger_id || !al.amount) continue;
          accountingLines.push({
            ledger_id: al.ledger_id,
            line_number: lineNumber++,
            debit_amount: al.amount > 0 ? al.amount : 0,
            credit_amount: al.amount < 0 ? Math.abs(al.amount) : 0,
          });
        }
      }

      accountingLines.push({
        ledger_id: partyLedgerId,
        line_number: lineNumber++,
        debit_amount: 0,
        credit_amount: finalGrandTotal,
      });
    }

    return {
      firm_id: activeFirmId,
      category,
      voucher_number: voucherNumber,
      voucher_date: form.voucher_date,
      narration: form.narration || null,
      party_ledger_id: partyLedgerId,
      original_invoice_number: form.original_invoice_number || null,
      original_invoice_date: form.original_invoice_date || null,
      discount_type: form.discount_type,
      accounting_lines: accountingLines,
      inventory_lines: finalInvoiceLines.map((line, index) => ({
        ...line,
        item_id: line.item_id,
        line_number: index + 1,
      })),
    };
  }

  if (family === "payment") {
    const partyLedgerId = requireSelection(form.party_ledger_id, "party ledger");
    const cashBankLedgerId = requireSelection(form.cash_bank_ledger_id, "cash or bank ledger");

    const isReceipt = category === "Receipt";

    // Map bill allocations from form state
    const billAllocations = form.bill_allocations
      .filter((a) => a.ref_name && a.amount > 0)
      .map((a) => ({
        ref_type: a.ref_type,
        ref_name: a.ref_name,
        amount: a.amount,
        amount_type: a.amount_type,
        due_date: a.due_date || null,
      }));

    return {
      firm_id: activeFirmId,
      category,
      voucher_number: voucherNumber,
      voucher_date: form.voucher_date,
      narration: form.narration || null,
      party_ledger_id: partyLedgerId,
      accounting_lines: [
        {
          ledger_id: isReceipt ? cashBankLedgerId : partyLedgerId,
          line_number: 1,
          debit_amount: form.amount,
          credit_amount: 0,
        },
        {
          ledger_id: isReceipt ? partyLedgerId : cashBankLedgerId,
          line_number: 2,
          debit_amount: 0,
          credit_amount: form.amount,
        },
      ],
      inventory_lines: [],
      bill_allocations: billAllocations.length > 0 ? billAllocations : undefined,
    };
  }

  if (family === "contra") {
    const sourceLedgerId = requireSelection(form.source_ledger_id, "transfer-from ledger");
    const destinationLedgerId = requireSelection(
      form.destination_ledger_id,
      "transfer-to ledger",
    );

    return {
      firm_id: activeFirmId,
      category,
      voucher_number: voucherNumber,
      voucher_date: form.voucher_date,
      narration: form.narration || null,
      party_ledger_id: null,
      accounting_lines: [
        {
          ledger_id: destinationLedgerId,
          line_number: 1,
          debit_amount: form.amount,
          credit_amount: 0,
        },
        {
          ledger_id: sourceLedgerId,
          line_number: 2,
          debit_amount: 0,
          credit_amount: form.amount,
        },
      ],
      inventory_lines: [],
    };
  }

  // journal / fallback
  const finalJournalLines = journalLines.filter((line) => {
    const isPristine = !line.ledger_id && !line.debit_amount && !line.credit_amount;
    return !isPristine;
  });

  requireLines(finalJournalLines, "journal line");
  for (const [index, line] of finalJournalLines.entries()) {
    requireSelection(line.ledger_id, `ledger on line ${index + 1}`);
  }

  return {
    firm_id: activeFirmId,
    category,
    voucher_number: voucherNumber,
    voucher_date: form.voucher_date,
    narration: form.narration || null,
    party_ledger_id: null,
    accounting_lines: finalJournalLines.map((line, index) => ({
      ...line,
      line_number: index + 1,
    })),
    inventory_lines: [],
  };
}
