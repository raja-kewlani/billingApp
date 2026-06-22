"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { VoucherDetail } from "@/interfaces/voucher";
import { apiRequest } from "@/lib/http";
import { useToast } from "@/context/ToastContext";
import { useDashboardChrome } from "@/context/DashboardChromeContext";
import { useProfile } from "@/context/ProfileContext";
import type { InvoiceData, InvoiceType } from "@/components/templates/types";

import { useFirmScope } from "./useFirmScope";
import { useFocusTraversal } from "./useFocusTraversal";
import { useDateFilter } from "@/context/DateFilterContext";
import { round2, numberToWords, recalcLine } from "./voucher/utils";
import { InvoicePreviewOverlay } from "./voucher/components/InvoicePreviewOverlay";
import { BillWiseDetailsModal } from "./voucher/components/BillWiseDetailsModal";
import { DebitCreditNoteDetailsModal } from "./voucher/components/DebitCreditNoteDetailsModal";

import {
  VoucherSlug,
  TaxMode,
  InvoiceLineState,
  JournalLineState,
  FormState,
  VOUCHER_META,
  getEmptyForm,
  EMPTY_INVOICE_LINE,
  EMPTY_JOURNAL_LINE,
} from "./voucher/types";
import { useVoucherData } from "./voucher/hooks/useVoucherData";
import { useVoucherHydration } from "./voucher/hooks/useVoucherHydration";
import { usePeriodBlock } from "./voucher/hooks/usePeriodBlock";
import { buildVoucherPayload } from "./voucher/buildPayload";
import { VoucherHeader } from "./voucher/components/VoucherHeader";
import { VoucherPartySection } from "./voucher/components/VoucherPartySection";
import { InvoiceItemsTable } from "./voucher/components/InvoiceItemsTable";
import { JournalLinesTable } from "./voucher/components/JournalLinesTable";
import { TotalsAndNarration } from "./voucher/components/TotalsAndNarration";
import { VoucherActionBar } from "./voucher/components/VoucherActionBar";


export function VoucherWorkbench({
  slug,
  voucherId,
  readOnly = false,
}: {
  slug: VoucherSlug;
  voucherId?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeFirmId, supabase } = useFirmScope();
  const { profile } = useProfile();
  const { showToast } = useToast();
  const meta = VOUCHER_META[slug];
  const isEditing = Boolean(voucherId);
  const { setBottomNavVisible } = useDashboardChrome();
  const { fromDate: globalFromDate, toDate: globalToDate } = useDateFilter();

  useLayoutEffect(() => {
    setBottomNavVisible(false);

    return () => {
      setBottomNavVisible(true);
    };
  }, [setBottomNavVisible]);

  const [form, setForm] = useState<FormState>(() => getEmptyForm(globalFromDate, globalToDate));
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineState[]>([{ ...EMPTY_INVOICE_LINE }]);
  const [journalLines, setJournalLines] = useState<JournalLineState[]>([
    { ...EMPTY_JOURNAL_LINE },
    { ...EMPTY_JOURNAL_LINE },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBillWise, setShowBillWise] = useState(false);
  const [showNoteDetailsModal, setShowNoteDetailsModal] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // ── Draft Management ──
  useEffect(() => {
    if (isEditing) {
      setIsDraftLoaded(true);
      return;
    }
    if (!activeFirmId) return;

    if (!isDraftLoaded) {
      try {
        const draftStr = sessionStorage.getItem(`draft-voucher-${activeFirmId}-${slug}`);
        if (draftStr) {
          const parsed = JSON.parse(draftStr);
          if (parsed.form) setForm(parsed.form);
          if (parsed.invoiceLines) setInvoiceLines(parsed.invoiceLines);
          if (parsed.journalLines) setJournalLines(parsed.journalLines);
        } else {
          // New voucher, load default preference
          const defaultDiscountType = localStorage.getItem("defaultDiscountType");
          if (defaultDiscountType === "amount" || defaultDiscountType === "percentage") {
            setForm(prev => ({ ...prev, discount_type: defaultDiscountType }));
          }
        }
      } catch (e) { }
      setIsDraftLoaded(true);
    }
  }, [isEditing, activeFirmId, slug, isDraftLoaded]);

  useEffect(() => {
    if (!isEditing && activeFirmId && isDraftLoaded) {
      const timeoutId = setTimeout(() => {
        sessionStorage.setItem(`draft-voucher-${activeFirmId}-${slug}`, JSON.stringify({
          form,
          invoiceLines,
          journalLines
        }));
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [form, invoiceLines, journalLines, isEditing, activeFirmId, slug, isDraftLoaded]);

  const itemsScrollRef = useRef<HTMLDivElement>(null);
  const prevInvoiceLinesLength = useRef(invoiceLines.length);
  const prevJournalLinesLength = useRef(journalLines.length);
  const prevAdditionalLedgersLength = useRef(form.additional_ledgers?.length || 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { initFocus, handleKeyDown } = useFocusTraversal(containerRef, {
    shortcutsEnabled: !readOnly,
  });

  useEffect(() => {
    if (!isLoading && activeFirmId) {
      initFocus();
    }
  }, [isLoading, activeFirmId, initFocus]);

  useEffect(() => {
    if (
      invoiceLines.length > prevInvoiceLinesLength.current ||
      journalLines.length > prevJournalLinesLength.current ||
      (form.additional_ledgers?.length || 0) > prevAdditionalLedgersLength.current
    ) {
      if (itemsScrollRef.current) {
        setTimeout(() => {
          if (itemsScrollRef.current) {
            itemsScrollRef.current.scrollTo({
              top: itemsScrollRef.current.scrollHeight,
              behavior: "smooth"
            });
          }
        }, 50);
      }
    }
    prevInvoiceLinesLength.current = invoiceLines.length;
    prevJournalLinesLength.current = journalLines.length;
    prevAdditionalLedgersLength.current = form.additional_ledgers?.length || 0;
  }, [invoiceLines.length, journalLines.length, form.additional_ledgers?.length]);

  // ── Data fetching via React Query ──
  const {
    ledgers,
    items,
    firmDetails,
    firmState,
    permanentDiscountToggle,
    depsReady,
    partyLedgers,
    cashBankLedgers,
    mainLedgers,
    allLedgerOptions,
    nextNumberData,
    rateInclusiveTaxToggle,
  } = useVoucherData(activeFirmId, supabase, meta.category, isEditing);

  const voucherDateObj = form.voucher_date ? new Date(form.voucher_date) : null;
  const { data: periodBlock } = usePeriodBlock(
    activeFirmId,
    supabase,
    voucherDateObj?.getFullYear() || null,
    (voucherDateObj?.getMonth() ?? -1) + 1 || null
  );

  const isMerchant = profile?.role === "merchant";
  const isBlocked = useMemo(() => {
    if (!isMerchant || !periodBlock) return false;
    if (meta.category === "Sales" && periodBlock.block_sales) return true;
    if (meta.category === "Purchase" && periodBlock.block_purchases) return true;
    if (meta.category === "Debit Note" && periodBlock.block_debit_notes) return true;
    if (meta.category === "Credit Note" && periodBlock.block_credit_notes) return true;
    return false;
  }, [isMerchant, periodBlock, meta.category]);

  const selectedPartyLedger = useMemo(
    () => ledgers.find((ledger) => ledger.id === form.party_ledger_id) || null,
    [form.party_ledger_id, ledgers],
  );

  const taxMode = useMemo<TaxMode>(() => {
    const partyState = selectedPartyLedger?.party_details?.state?.trim().toLowerCase();
    const normalizedFirmState = firmState.trim().toLowerCase();
    if (partyState && normalizedFirmState) {
      return partyState === normalizedFirmState ? "intra" : "inter";
    }
    // We no longer fallback to manual_tax_mode. Validation in buildPayload will catch missing states.
    return "intra";
  }, [firmState, selectedPartyLedger]);

  useEffect(() => {
    if (meta.family !== "invoice") return;

    setInvoiceLines((prevLines) => {
      let hasChanges = false;
      const newLines = prevLines.map((line) => {
        if (!line.item_id) return line;
        const item = items.find((i) => i.id === line.item_id);
        const newLine = recalcLine(line, item, taxMode, form.discount_type);

        if (
          newLine.igst_amount !== line.igst_amount ||
          newLine.cgst_amount !== line.cgst_amount ||
          newLine.sgst_amount !== line.sgst_amount ||
          newLine.igst_rate !== line.igst_rate ||
          newLine.cgst_rate !== line.cgst_rate ||
          newLine.sgst_rate !== line.sgst_rate
        ) {
          hasChanges = true;
        }

        return newLine;
      });

      return hasChanges ? newLines : prevLines;
    });
  }, [taxMode, items, meta.family, form.discount_type, rateInclusiveTaxToggle]);

  const invoiceTotals = useMemo(() => {
    const taxable = round2(invoiceLines.reduce((sum, line) => sum + line.taxable_amount, 0));
    const igst = round2(invoiceLines.reduce((sum, line) => sum + line.igst_amount, 0));
    const cgst = round2(invoiceLines.reduce((sum, line) => sum + line.cgst_amount, 0));
    const sgst = round2(invoiceLines.reduce((sum, line) => sum + line.sgst_amount, 0));
    return {
      taxable,
      igst,
      cgst,
      sgst,
      grandTotal: round2(taxable + igst + cgst + sgst),
    };
  }, [invoiceLines]);

  // ── Voucher hydration (only when editing an existing voucher) ──
  useVoucherHydration({
    depsReady,
    voucherId,
    ledgers,
    family: meta.family,
    supabase,
    setForm,
    setInvoiceLines,
    setJournalLines,
    setIsLoading,
    showToast,
  });


  const toggleDiscountType = useCallback(() => {
    setForm((prev) => {
      const nextType = prev.discount_type === "percentage" ? "amount" : "percentage";
      localStorage.setItem("defaultDiscountType", nextType);
      return { ...prev, discount_type: nextType };
    });
  }, []);

  useEffect(() => {
    if (nextNumberData?.next_number && !isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => {
        // Only set it once if it's currently empty, avoiding reset on user erase
        if (prev.voucher_number === "") {
          return { ...prev, voucher_number: nextNumberData.next_number };
        }
        return prev;
      });
    }
  }, [nextNumberData, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => {
        let changed = false;
        const next = { ...prev };

        if (meta.family === "invoice" && mainLedgers.length > 0 && !prev.main_ledger_id) {
          next.main_ledger_id = mainLedgers[0].value;
          changed = true;
        }

        if (meta.family === "payment" && cashBankLedgers.length > 0 && !prev.cash_bank_ledger_id) {
          next.cash_bank_ledger_id = cashBankLedgers[0].value;
          changed = true;
        }

        if (meta.family === "contra" && cashBankLedgers.length > 0) {
          if (!prev.source_ledger_id) {
            next.source_ledger_id = cashBankLedgers[0].value;
            changed = true;
          }
          if (!prev.destination_ledger_id) {
            next.destination_ledger_id = cashBankLedgers.length > 1 ? cashBankLedgers[1].value : cashBankLedgers[0].value;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }
  }, [meta.family, isEditing, mainLedgers, cashBankLedgers]);

  /** Serialize live form state into InvoiceData for template preview */
  const buildPreviewData = useCallback((): InvoiceData | null => {
    if (!firmDetails) return null;

    const categoryToType: Record<string, InvoiceType> = {
      Sales: "TAX INVOICE",
      Purchase: "PURCHASE INVOICE",
      "Debit Note": "DEBIT NOTE",
      "Credit Note": "CREDIT NOTE",
    };

    const lineItems = invoiceLines
      .filter((line) => {
        const isPristine = !line.item_id && (line.quantity === 1 || !line.quantity) && !line.unit_price && !line.discount_amount;
        return !isPristine;
      })
      .map((line, idx) => {
        const item = items.find((i) => i.id === line.item_id);
        return {
          srNo: idx + 1,
          name: item?.name || "(unnamed item)",
          hsnSac: item?.hsn_code || "",
          quantity: line.quantity,
          uom: item?.uom_name || "NOS",
          inclusiveRate: line.inclusive_rate,
          rate: line.unit_price,
          discount: form.discount_type === "percentage" ? line.discount_percent : line.discount_amount,
          taxableAmount: line.taxable_amount,
          igstRate: line.igst_rate || undefined,
          cgstRate: line.cgst_rate || undefined,
          sgstRate: line.sgst_rate || undefined,
          igstAmount: line.igst_amount || undefined,
          cgstAmount: line.cgst_amount || undefined,
          sgstAmount: line.sgst_amount || undefined,
        };
      });

    // Build Tax-rate level breakdown
    const taxMap = new Map<string, { taxableValue: number; igstRate: number; igstAmount: number; cgstRate: number; cgstAmount: number; sgstRate: number; sgstAmount: number }>();
    for (const line of lineItems) {
      const igstR = line.igstRate || 0;
      const cgstR = line.cgstRate || 0;
      const sgstR = line.sgstRate || 0;

      let rateKey = "0%";
      if (igstR > 0) rateKey = `${igstR}%`;
      else if (cgstR + sgstR > 0) rateKey = `${cgstR + sgstR}%`;

      const existing = taxMap.get(rateKey) || { taxableValue: 0, igstRate: 0, igstAmount: 0, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0 };
      existing.taxableValue += line.taxableAmount;
      existing.igstRate = line.igstRate || existing.igstRate;
      existing.igstAmount += line.igstAmount || 0;
      existing.cgstRate = line.cgstRate || existing.cgstRate;
      existing.cgstAmount += line.cgstAmount || 0;
      existing.sgstRate = line.sgstRate || existing.sgstRate;
      existing.sgstAmount += line.sgstAmount || 0;
      taxMap.set(rateKey, existing);
    }

    const taxBreakdown = Array.from(taxMap.entries()).map(([rateKey, data]) => ({
      taxRate: rateKey,
      taxableValue: data.taxableValue,
      igstRate: data.igstRate || undefined,
      igstAmount: data.igstAmount || undefined,
      cgstRate: data.cgstRate || undefined,
      cgstAmount: data.cgstAmount || undefined,
      sgstRate: data.sgstRate || undefined,
      sgstAmount: data.sgstAmount || undefined,
      totalTax: data.igstAmount + data.cgstAmount + data.sgstAmount,
    }));

    const partyLedger = ledgers.find((l) => l.id === form.party_ledger_id);
    const isPurchase = meta.category === "Purchase" || meta.category === "Debit Note";

    const firmAsCompany = {
      name: firmDetails.name,
      address: firmDetails.address,
      phone: firmDetails.phone,
      email: firmDetails.email,
      gstin: firmDetails.gstin,
      pan: firmDetails.pan,
      state: firmDetails.state,
    };

    const partyAsCompany = {
      name: partyLedger?.name || "—",
      address: partyLedger?.party_details?.address || "",
      phone: undefined,
      email: undefined,
      gstin: partyLedger?.party_details?.gstin || undefined,
      pan: undefined,
      state: partyLedger?.party_details?.state || undefined,
    };

    const firmAsParty = {
      name: firmDetails.name,
      address: firmDetails.address,
      phone: firmDetails.phone,
      gstin: firmDetails.gstin,
      state: firmDetails.state,
      placeOfSupply: firmDetails.state,
    };

    const partyAsParty = {
      name: partyLedger?.name || "—",
      address: partyLedger?.party_details?.address || undefined,
      phone: undefined,
      gstin: partyLedger?.party_details?.gstin || undefined,
      state: partyLedger?.party_details?.state || undefined,
      placeOfSupply: partyLedger?.party_details?.state || undefined,
    };

    return {
      type: categoryToType[meta.category] || "TAX INVOICE",
      invoiceNumber: form.voucher_number || "—",
      invoiceDate: form.voucher_date
        ? new Date(form.voucher_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "—",
      company: isPurchase ? partyAsCompany : firmAsCompany,
      party: isPurchase ? firmAsParty : partyAsParty,
      items: lineItems,
      taxBreakdown,
      subtotal: invoiceTotals.taxable,
      igstTotal: invoiceTotals.igst || undefined,
      cgstTotal: invoiceTotals.cgst || undefined,
      sgstTotal: invoiceTotals.sgst || undefined,
      additionalLedgers: form.additional_ledgers?.map(l => ({
        name: ledgers.find(led => led.id === l.ledger_id)?.name || "Additional Ledger",
        amount: Number(l.amount) || 0,
      })) || [],
      grandTotal: invoiceTotals.grandTotal + (form.additional_ledgers?.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) || 0),
      totalInWords: numberToWords(invoiceTotals.grandTotal + (form.additional_ledgers?.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) || 0)),
      bankDetails: (!isPurchase && firmDetails.bankName)
        ? {
          bankName: firmDetails.bankName,
          branch: firmDetails.branchName || "",
          accountNumber: firmDetails.accountNumber || "",
          ifsc: firmDetails.ifscCode || "",
        }
        : undefined,
      discountType: form.discount_type,
    };
  }, [firmDetails, invoiceLines, items, invoiceTotals, form, ledgers, meta.category]);

  function buildPayload() {
    if (!activeFirmId) throw new Error("No active firm selected");
    return buildVoucherPayload({
      activeFirmId,
      form,
      family: meta.family,
      category: meta.category,
      invoiceLines,
      invoiceTotals,
      journalLines,
      ledgers,
      firmState,
    });
  }

  async function submit() {
    try {
      setIsSubmitting(true);
      const payload = buildPayload();

      const result = isEditing
        ? await apiRequest<VoucherDetail>(supabase, `/api/vouchers/${voucherId}`, {
          method: "PUT",
          body: payload,
        })
        : await apiRequest<VoucherDetail>(supabase, "/api/vouchers/", {
          method: "POST",
          body: payload,
        });

      showToast(`Voucher ${isEditing ? "updated" : "saved"} successfully!`, "success");

      if (isEditing) {
        router.push(`/dashboard/vouchers/${result.id}`);
      } else {
        sessionStorage.removeItem(`draft-voucher-${activeFirmId}-${slug}`);
        setForm((prev) => ({
          ...getEmptyForm(globalFromDate, globalToDate),
          voucher_date: prev.voucher_date,
        }));
        setInvoiceLines([{ ...EMPTY_INVOICE_LINE }]);
        setJournalLines([
          { ...EMPTY_JOURNAL_LINE },
          { ...EMPTY_JOURNAL_LINE },
        ]);

        setTimeout(() => {
          initFocus();
        }, 50);
      }

      if (activeFirmId) {
        // Invalidate all queries that could be affected by a voucher change
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["next-voucher-number", activeFirmId, meta.category] }),
          queryClient.invalidateQueries({ queryKey: ["register"] }),
          queryClient.invalidateQueries({ queryKey: ["ledgers"] }),
          queryClient.invalidateQueries({ queryKey: ["ledger-statement"] }),
          queryClient.invalidateQueries({ queryKey: ["overview"] }),
          queryClient.invalidateQueries({ queryKey: ["stock-summary"] }),
          queryClient.invalidateQueries({ queryKey: ["stock-monthly"] }),
          queryClient.invalidateQueries({ queryKey: ["stock-vouchers"] }),
          queryClient.invalidateQueries({ queryKey: ["voucher"] }),
        ]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save voucher", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAutoFill(invoiceNo: string) {
    if (!activeFirmId || !form.party_ledger_id) return;
    try {
      setIsLoading(true);
      const categoryToFetch = meta.category === "Debit Note" ? "Purchase" : "Sales";
      const params = new URLSearchParams({
        firm_id: activeFirmId,
        category: categoryToFetch,
        voucher_number: invoiceNo,
        party_ledger_id: form.party_ledger_id,
      });

      const response = await apiRequest<any[]>(supabase, `/api/vouchers/?${params.toString()}`);
      if (response && response.length > 0) {
        const originalInvoiceId = response[0].id;
        const detail = await apiRequest<VoucherDetail>(supabase, `/api/vouchers/${originalInvoiceId}`);

        // Auto-fill form details
        setForm((prev) => ({
          ...prev,
        }));

        if (detail.inventory_lines && detail.inventory_lines.length > 0) {
          setInvoiceLines(detail.inventory_lines.map(line => ({
            ...EMPTY_INVOICE_LINE,
            item_id: line.item_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_amount: line.discount_amount,
            taxable_amount: line.taxable_amount,
            igst_rate: line.igst_rate,
            cgst_rate: line.cgst_rate,
            sgst_rate: line.sgst_rate,
            igst_amount: line.igst_amount,
            cgst_amount: line.cgst_amount,
            sgst_amount: line.sgst_amount,
          })));
        }
        showToast("Auto-filled from original invoice successfully!", "success");
      } else {
        showToast("Original invoice not found. Please verify the number.", "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to fetch original invoice", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyInvoice(invoiceNo: string): Promise<boolean> {
    if (!activeFirmId || !form.party_ledger_id) {
      throw new Error("Please select a party first.");
    }
    const categoryToFetch = meta.category === "Debit Note" ? "Purchase" : "Sales";
    const params = new URLSearchParams({
      firm_id: activeFirmId,
      category: categoryToFetch,
      voucher_number: invoiceNo,
    });

    const response = await apiRequest<any[]>(supabase, `/api/vouchers/?${params.toString()}`);
    if (response && response.length > 0) {
      const invoice = response[0];
      if (invoice.party_ledger_id !== form.party_ledger_id) {
        throw new Error("This invoice does not belong to the selected party.");
      }
      return true;
    }
    throw new Error("Original invoice not found. Please verify the number.");
  }

  if (!depsReady || isLoading) {
    return (
      <div className="flex flex-col w-full min-h-[calc(100vh-var(--bottom-nav-height)-1rem)] lg:h-[calc(100vh-2rem)] lg:min-h-[800px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-shimmer-fast rounded-md bg-slate-200" />
            <div className="h-6 w-48 animate-shimmer-fast rounded-full bg-slate-200" />
          </div>
          <div className="h-8 w-32 animate-shimmer-fast rounded-full bg-slate-200" />
        </div>
        <div className="h-px w-full bg-slate-100" />

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-5 w-24 animate-shimmer-fast rounded-full bg-slate-200" />
            <div className="h-12 w-full animate-shimmer-fast rounded-xl bg-slate-200" style={{ animationDelay: "0.1s" }} />
          </div>
          <div className="space-y-4">
            <div className="h-5 w-24 animate-shimmer-fast rounded-full bg-slate-200" />
            <div className="h-12 w-full animate-shimmer-fast rounded-xl bg-slate-200" style={{ animationDelay: "0.1s" }} />
          </div>
        </div>

        <div className="mt-8 space-y-4 flex-1">
          <div className="h-8 w-full animate-shimmer-fast rounded-xl bg-slate-100" style={{ animationDelay: "0.2s" }} />
          <div className="h-12 w-full animate-shimmer-fast rounded-xl bg-slate-100" style={{ animationDelay: "0.3s" }} />
          <div className="h-12 w-full animate-shimmer-fast rounded-xl bg-slate-100" style={{ animationDelay: "0.4s" }} />
          <div className="h-12 w-full animate-shimmer-fast rounded-xl bg-slate-100" style={{ animationDelay: "0.5s" }} />
        </div>

        <div className="h-px w-full bg-slate-100 mt-auto" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-10 w-48 animate-shimmer-fast rounded-xl bg-slate-200" />
          <div className="h-10 w-64 animate-shimmer-fast rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} onKeyDownCapture={handleKeyDown} className="voucher-container flex flex-col w-full min-h-[calc(100vh-var(--bottom-nav-height)-1rem)] lg:h-[calc(100vh/var(--scale-voucher-absolute)-2rem)] lg:min-h-[800px] rounded-xl border border-slate-300 bg-white shadow-sm overflow-y-auto scroll-pb-[300px] lg:scroll-pb-[450px]" style={{ zoom: "var(--scale-voucher-relative)" } as React.CSSProperties}>
      {/* ── Voucher Command Ribbon ── */}
      <VoucherHeader
        meta={meta}
        isEditing={isEditing}
        readOnly={readOnly}
        form={form}
        setForm={setForm}
        globalFromDate={globalFromDate}
        globalToDate={globalToDate}
        onOpenNoteDetails={() => setShowNoteDetailsModal(true)}
      />

      {/* ── Period Block Warning Banner ── */}
      {isBlocked && (
        <div className="mx-5 sm:mx-7 mt-2 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium">
            This period is blocked for {meta.category.toLowerCase()}s. You cannot create or edit this voucher unless it is unblocked by your CA.
          </p>
        </div>
      )}

      {/* ── Zone B: Party / Ledger / Payment Table ── */}
      <VoucherPartySection
        meta={meta}
        form={form}
        setForm={setForm}
        cashBankLedgers={cashBankLedgers}
        partyLedgers={partyLedgers}
        mainLedgers={mainLedgers}
        allLedgerOptions={allLedgerOptions}
        selectedPartyLedger={selectedPartyLedger}
        taxMode={taxMode}
        readOnly={readOnly}
        onOpenBillWise={() => setShowBillWise(true)}
        onPartySelected={() => setShowNoteDetailsModal(true)}
      />

      {/* ── Zone C: Items Table ── */}
      {meta.family === "invoice" ? (
        <InvoiceItemsTable
          invoiceLines={invoiceLines}
          setInvoiceLines={setInvoiceLines}
          items={items}
          taxMode={taxMode}
          readOnly={readOnly}
          itemsScrollRef={itemsScrollRef}
          showDiscount={permanentDiscountToggle}
          discountType={form.discount_type}
          onToggleDiscountType={toggleDiscountType}
          rateInclusive={rateInclusiveTaxToggle}
        />
      ) : null}

      {meta.family === "journal" ? (
        <JournalLinesTable
          journalLines={journalLines}
          setJournalLines={setJournalLines}
          allLedgerOptions={allLedgerOptions}
          readOnly={readOnly}
          itemsScrollRef={itemsScrollRef}
        />
      ) : null}

      {/* ── Zone D: Narration + Totals ── */}
      <TotalsAndNarration
        meta={meta}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
        taxMode={taxMode}
        invoiceTotals={invoiceTotals}
        ledgers={ledgers}
      />

      {/* ── Zone E: Footer Actions ── */}
      <VoucherActionBar
        meta={meta}
        isEditing={isEditing}
        readOnly={readOnly}
        isSubmitting={isSubmitting}
        isLoading={isLoading}
        voucherId={voucherId}
        isBlocked={isBlocked}
        onCancel={() => {
          if (!isEditing && activeFirmId) {
            sessionStorage.removeItem(`draft-voucher-${activeFirmId}-${slug}`);
          }
          if (isEditing) {
            router.push(`/dashboard/vouchers/${voucherId}`);
          } else {
            router.push("/dashboard");
          }
        }}
        onSubmit={() => void submit()}
        onPreview={() => setShowPreview(true)}
        onOpenNoteDetails={() => setShowNoteDetailsModal(true)}
      />

      {/* ── Invoice Preview Overlay ── */}
      {showPreview && meta.family === "invoice" && (
        <InvoicePreviewOverlay
          buildPreviewData={buildPreviewData}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── Debit/Credit Note Details Modal ── */}
      {(meta.category === "Debit Note" || meta.category === "Credit Note") && (
        <DebitCreditNoteDetailsModal
          open={showNoteDetailsModal}
          onClose={() => setShowNoteDetailsModal(false)}
          form={form}
          setForm={setForm}
          onAutoFill={handleAutoFill}
          onVerifyInvoice={verifyInvoice}
          isCreditNote={meta.category === "Credit Note"}
        />
      )}

      {/* ── Bill-wise Details Modal ── */}
      {showBillWise && meta.family === "payment" && activeFirmId && (
        <BillWiseDetailsModal
          open={showBillWise}
          onClose={() => setShowBillWise(false)}
          onSave={(allocations) => {
            setForm((prev) => ({ ...prev, bill_allocations: allocations }));
          }}
          partyName={selectedPartyLedger?.name || "Party"}
          totalAmount={form.amount}
          allocationAmountType={meta.category === "Receipt" ? "Cr" : "Dr"}
          firmId={activeFirmId}
          partyLedgerId={form.party_ledger_id}
          supabase={supabase}
          existingAllocations={form.bill_allocations}
          voucherDate={form.voucher_date}
        />
      )}
    </div>
  );
}



