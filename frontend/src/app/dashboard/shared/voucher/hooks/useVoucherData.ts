import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { LedgerDetail } from "@/interfaces/ledger";
import { ItemDetail } from "@/interfaces/inventory";
import { VoucherCategory } from "@/interfaces/voucher";
import { apiRequest } from "@/lib/http";

export function isPartyLedger(ledger: LedgerDetail) {
  return ledger.template_type === "party";
}

export function isCashBankLedger(ledger: LedgerDetail) {
  const groupName = (ledger.group_name || "").toLowerCase();
  return ledger.template_type === "bank" || groupName.includes("cash") || groupName.includes("bank");
}

export function isTaxLedger(ledger: LedgerDetail) {
  return ledger.template_type === "tax";
}

export function isMainInvoiceLedger(ledger: LedgerDetail, category: VoucherCategory) {
  const groupName = (ledger.group_name || "").toLowerCase();
  if (category === "Sales" || category === "Credit Note") {
    return groupName.includes("sales") || ledger.group_nature === "Income";
  }
  return groupName.includes("purchase") || ledger.group_nature === "Expense";
}

export function useVoucherData(activeFirmId: string | null, supabase: SupabaseClient, category: VoucherCategory, isEditing: boolean) {
  const { data: ledgers = [], isLoading: ledgersLoading } = useQuery({
    queryKey: ["ledgers", activeFirmId],
    queryFn: () =>
      apiRequest<LedgerDetail[]>(supabase, "/api/ledgers/", { query: { firm_id: activeFirmId } }),
    enabled: !!activeFirmId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", activeFirmId],
    queryFn: () =>
      apiRequest<ItemDetail[]>(supabase, "/api/items/", {
        query: { firm_id: activeFirmId, active_only: false },
      }),
    enabled: !!activeFirmId,
  });

  const { data: firmQueryData, isLoading: firmLoading } = useQuery({
    queryKey: ["firm-details", activeFirmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firms")
        .select("name, mailing_name, address_lane1, city, state, pincode, mobile, email, gstin, pan, bank_name, account_number, ifsc_code, branch_name, permanent_discount_toggle")
        .eq("id", activeFirmId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeFirmId,
  });

  const firmState = firmQueryData?.state || "";
  const permanentDiscountToggle = firmQueryData?.permanent_discount_toggle || false;
  const firmDetails = firmQueryData
    ? {
      name: firmQueryData.mailing_name || firmQueryData.name || "",
      address: [firmQueryData.address_lane1, firmQueryData.city, firmQueryData.state ? `${firmQueryData.state} - ${firmQueryData.pincode || ""}` : firmQueryData.pincode].filter(Boolean).join(",\n"),
      phone: firmQueryData.mobile || undefined,
      email: firmQueryData.email || undefined,
      gstin: firmQueryData.gstin || undefined,
      pan: firmQueryData.pan || undefined,
      state: firmQueryData.state || undefined,
      bankName: firmQueryData.bank_name || undefined,
      accountNumber: firmQueryData.account_number || undefined,
      ifscCode: firmQueryData.ifsc_code || undefined,
      branchName: firmQueryData.branch_name || undefined,
    }
    : null;

  const partyLedgers = useMemo(
    () => ledgers.filter((l) => isPartyLedger(l) || isCashBankLedger(l)).map((ledger) => ({ value: ledger.id, label: `${ledger.name} • ${ledger.group_name || "Party"}` })),
    [ledgers],
  );
  const cashBankLedgers = useMemo(
    () => ledgers.filter(isCashBankLedger).map((ledger) => ({ value: ledger.id, label: ledger.name })),
    [ledgers],
  );
  const mainLedgers = useMemo(
    () => ledgers.filter((ledger) => isMainInvoiceLedger(ledger, category)).map((ledger) => ({ value: ledger.id, label: `${ledger.name} • ${ledger.group_name || "Main ledger"}` })),
    [ledgers, category],
  );
  const allLedgerOptions = useMemo(
    () => ledgers.map((ledger) => ({ value: ledger.id, label: `${ledger.name} • ${ledger.group_name || "Ledger"}` })),
    [ledgers],
  );

  const { data: nextNumberData, isLoading: nextNumLoading } = useQuery({
    queryKey: ["next-voucher-number", activeFirmId, category],
    queryFn: () =>
      apiRequest<{ next_number: string }>(supabase, "/api/vouchers/next-number", {
        query: { firm_id: activeFirmId, category: category },
      }),
    enabled: !!activeFirmId && !isEditing,
  });

  const queriesLoading = ledgersLoading || itemsLoading || firmLoading || (!isEditing && nextNumLoading);
  const depsReady = !!activeFirmId && !queriesLoading;

  return {
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
  };
}
