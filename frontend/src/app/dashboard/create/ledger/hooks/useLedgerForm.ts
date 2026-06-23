"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { AccountGroup, LedgerDetail, LedgerTemplateType, LedgerWritePayload } from "@/interfaces/ledger";
import { apiRequest } from "@/lib/http";
import { useDashboardChrome } from "@/context/DashboardChromeContext";
import { useFirmScope } from "@/app/dashboard/shared/useFirmScope";
import { useToast } from "@/context/ToastContext";

import { LedgerFormState, BankSectionMeta, BankSectionErrors } from "../types";
import { EMPTY_FORM, EMPTY_BANK_META, DR_GROUPS, CR_GROUPS } from "../constants";
import { resolveTemplateType, validateBankSection } from "../utils";

function getFreshEmptyLedgerForm() {
  return {
    ...EMPTY_FORM,
    bank_details: { ...EMPTY_FORM.bank_details },
    party_details: { ...EMPTY_FORM.party_details },
    tax_details: { ...EMPTY_FORM.tax_details },
  };
}

export function useLedgerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const ledgerId = searchParams.get("ledger_id");
  const { activeFirmId, supabase } = useFirmScope();
  const { showToast } = useToast();
  const { setBottomNavVisible } = useDashboardChrome();

  const [form, setForm] = useState<LedgerFormState>(EMPTY_FORM);
  const [bankMeta, setBankMeta] = useState<BankSectionMeta>(EMPTY_BANK_META);
  const [bankErrors, setBankErrors] = useState<BankSectionErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingGst, setIsFetchingGst] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // ── Bottom nav ──
  useLayoutEffect(() => {
    setBottomNavVisible(false);
    return () => setBottomNavVisible(true);
  }, [setBottomNavVisible]);

  // ── Data fetching ──
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["account-groups", activeFirmId],
    queryFn: () =>
      apiRequest<AccountGroup[]>(supabase, "/api/ledgers/account-groups", {
        query: { firm_id: activeFirmId },
      }),
    enabled: !!activeFirmId,
  });

  const { data: existingLedger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["ledger", activeFirmId, ledgerId],
    queryFn: () => apiRequest<LedgerDetail>(supabase, `/api/ledgers/${ledgerId}`),
    enabled: !!activeFirmId && !!ledgerId,
  });

  const isLoading = groupsLoading || ledgerLoading;

  // ── Derived state ──
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === form.group_id) ?? null,
    [form.group_id, groups],
  );
  const templateType = useMemo(() => resolveTemplateType(selectedGroup), [selectedGroup]);

  // ── Auto-set opening balance type on group change ──
  useEffect(() => {
    if (!selectedGroup) return;
    if (DR_GROUPS.includes(selectedGroup.name)) {
      setForm((prev) => ({ ...prev, opening_balance_type: "Dr" }));
    } else if (CR_GROUPS.includes(selectedGroup.name)) {
      setForm((prev) => ({ ...prev, opening_balance_type: "Cr" }));
    }
  }, [selectedGroup]);

  // ── Clear bank errors when template changes ──
  useEffect(() => {
    if (templateType !== "bank") setBankErrors({});
  }, [templateType]);

  // ── Default group_id on first groups load (new ledger only) ──
  useEffect(() => {
    if (!ledgerId && groups.length > 0 && !form.group_id) {
      setForm((prev) => ({ ...prev, group_id: prev.group_id || groups[0].id }));
    }
  }, [groups, ledgerId, form.group_id]);

  // ── Hydrate form when editing an existing ledger ──
  useEffect(() => {
    if (!existingLedger || hasHydrated) return;
    setForm({
      name: existingLedger.name,
      alias: existingLedger.alias || "",
      group_id: existingLedger.group_id,
      opening_balance: existingLedger.opening_balance,
      opening_balance_type: existingLedger.opening_balance_type,
      inventory_values_affected: existingLedger.inventory_values_affected,
      cost_centre_applicable: existingLedger.cost_centre_applicable,
      type_of_ledger: existingLedger.type_of_ledger || "Not Applicable",
      rounding_method: existingLedger.rounding_method || null,
      rounding_limit: existingLedger.rounding_limit || 1,
      bank_details: {
        account_number: existingLedger.bank_details?.account_number || "",
        ifsc_code: existingLedger.bank_details?.ifsc_code || "",
        swift_code: existingLedger.bank_details?.swift_code || "",
        bank_name: existingLedger.bank_details?.bank_name || "",
        branch_name: existingLedger.bank_details?.branch_name || "",
      },
      party_details: {
        maintain_bill_by_bill: existingLedger.party_details?.maintain_bill_by_bill || false,
        default_credit_days: existingLedger.party_details?.default_credit_days || 0,
        mailing_name: existingLedger.party_details?.mailing_name || "",
        address: existingLedger.party_details?.address || "",
        state: existingLedger.party_details?.state || "",
        country: existingLedger.party_details?.country || "India",
        pincode: existingLedger.party_details?.pincode || "",
        pan_number: existingLedger.party_details?.pan_number || "",
        gst_registration_type: existingLedger.party_details?.gst_registration_type || "",
        gstin: existingLedger.party_details?.gstin || "",
      },
      tax_details: {
        duty_tax_type: existingLedger.tax_details?.duty_tax_type || "",
        tax_percentage: existingLedger.tax_details?.tax_percentage || 0,
      },
    });
    setHasHydrated(true);
  }, [existingLedger, hasHydrated]);

  // ── GST fetch ──
  const handleFetchGstDetails = async () => {
    const gstin = form.party_details.gstin.trim();
    if (!gstin.match(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/)) {
      showToast("Invalid GSTIN format", "error");
      return;
    }
    setIsFetchingGst(true);
    try {
      const data = await apiRequest<any>(supabase, `/api/firms/gst/fetch?gstin=${gstin}`);
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        party_details: {
          ...prev.party_details,
          address: data.address_lane1
            ? `${data.address_lane1}${data.city ? `, ${data.city}` : ""}`
            : prev.party_details.address,
          state: data.state || prev.party_details.state,
          pincode: data.pincode || prev.party_details.pincode,
          pan_number: data.pan || prev.party_details.pan_number,
          gst_registration_type: data.gstin ? "Regular" : prev.party_details.gst_registration_type,
        },
      }));
      showToast("GST details fetched successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to fetch GST details", "error");
    } finally {
      setIsFetchingGst(false);
    }
  };

  // ── Submit ──
  const submit = async () => {
    if (!activeFirmId) return;
    try {
      setIsSubmitting(true);

      if (templateType === "bank") {
        const validationErrors = validateBankSection(form.bank_details, bankMeta);
        if (Object.keys(validationErrors).length > 0) {
          setBankErrors(validationErrors);
          showToast("Please complete the bank details before saving.", "error");
          return;
        }
      }

      if (templateType === "party" || templateType === "bank") {
        const gstType = form.party_details.gst_registration_type;
        const gstin = form.party_details.gstin?.trim();

        if (gstin) {
          if (gstType !== "Regular" && gstType !== "Composition") {
            showToast("A GSTIN is provided, so the Registration Type must be Regular or Composition.", "error");
            return;
          }
        } else {
          if (gstType === "Regular" || gstType === "Composition") {
            showToast("A GSTIN is required for Regular or Composition registration types.", "error");
            return;
          }
        }

        if (!form.party_details.state.trim()) {
          showToast(
            `State is mandatory for ${templateType === "bank" ? "Bank" : "Party"} ledgers to calculate GST.`,
            "error",
          );
          return;
        }
      }

      setBankErrors({});

      const payload: LedgerWritePayload = {
        firm_id: activeFirmId,
        group_id: form.group_id,
        name: form.name.trim(),
        alias: form.alias ? form.alias.trim() : null,
        opening_balance: Number(form.opening_balance || 0),
        opening_balance_type: form.opening_balance_type,
        inventory_values_affected: form.inventory_values_affected,
        cost_centre_applicable: form.cost_centre_applicable,
        type_of_ledger: form.type_of_ledger,
        rounding_method: form.type_of_ledger === "Invoice Rounding" ? form.rounding_method : null,
        rounding_limit: form.type_of_ledger === "Invoice Rounding" ? Number(form.rounding_limit || 1) : 1,
        bank_details:
          templateType === "bank"
            ? {
                account_number: form.bank_details.account_number?.trim() || null,
                ifsc_code: form.bank_details.ifsc_code?.trim() || null,
                swift_code: form.bank_details.swift_code?.trim() || null,
                bank_name: form.bank_details.bank_name?.trim() || null,
                branch_name: form.bank_details.branch_name?.trim() || null,
              }
            : null,
        party_details:
          templateType === "party" || templateType === "bank"
            ? {
                maintain_bill_by_bill: templateType === "bank" ? false : form.party_details.maintain_bill_by_bill,
                default_credit_days: templateType === "bank" ? null : form.party_details.default_credit_days || null,
                mailing_name: form.party_details.mailing_name?.trim() || null,
                address: form.party_details.address?.trim() || null,
                state: form.party_details.state?.trim() || null,
                country: form.party_details.country?.trim() || null,
                pincode: form.party_details.pincode?.trim() || null,
                pan_number: form.party_details.pan_number?.trim() || null,
                gst_registration_type: form.party_details.gst_registration_type || null,
                gstin: form.party_details.gstin?.trim() || null,
              }
            : null,
        tax_details:
          templateType === "tax"
            ? {
                duty_tax_type: form.tax_details.duty_tax_type || null,
                tax_percentage: form.tax_details.tax_percentage || null,
              }
            : null,
      };

      if (ledgerId) {
        await apiRequest<LedgerDetail>(supabase, `/api/ledgers/${ledgerId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest<LedgerDetail>(supabase, "/api/ledgers/", {
          method: "POST",
          body: payload,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["ledgers", activeFirmId] });
      if (ledgerId) {
        await queryClient.invalidateQueries({ queryKey: ["ledger", activeFirmId, ledgerId] });
        await queryClient.invalidateQueries({ queryKey: ["ledger-statement", ledgerId] });
      } else {
        setForm(getFreshEmptyLedgerForm());
        setBankMeta(EMPTY_BANK_META);
        setBankErrors({});
      }

      const returnTo = searchParams.get("returnTo");
      if (ledgerId && returnTo) {
        router.push(returnTo);
      } else if (ledgerId) {
        router.push("/dashboard/books/ledger");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save ledger", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // State
    form,
    setForm,
    bankMeta,
    setBankMeta,
    bankErrors,
    setBankErrors,
    isSubmitting,
    isFetchingGst,
    isLoading,
    // Derived
    groups,
    templateType,
    ledgerId,
    // Actions
    handleFetchGstDetails,
    submit,
    returnTo: searchParams.get("returnTo"),
  };
}
