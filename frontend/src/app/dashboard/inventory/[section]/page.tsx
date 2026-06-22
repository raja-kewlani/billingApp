"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Hsn, ItemDetail, Uom } from "@/interfaces/inventory";
import { apiRequest } from "@/lib/http";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useToast } from "@/context/ToastContext";

import { EmptyState, PageHero, SurfaceCard, ConfirmModal } from "../../shared/WorkspaceUi";
import { useFirmScope } from "../../shared/useFirmScope";
import { useSelection } from "../../shared/useSelection";
import SelectionRow from "../../shared/SelectionRow";
import SelectionActionBar from "../../shared/SelectionActionBar";
import { getApiBaseUrl } from "@/lib/api";

type SectionKey = "items" | "hsn" | "uom";



type UomForm = {
  name: string;
  formal_name: string;
  uqc_code: string;
  decimal_places: number;
};

type HsnForm = {
  hsn_code: string;
  description: string;
  code_type: string;
  is_active: boolean;
};


const GST_UQCS = [
  "Not Applicable", "BAG-BAGS", "BAL-BALE", "BDL-BUNDLES", "BKL-BUCKLES",
  "BOU-BILLION OF UNITS", "BOX-BOX", "BTL-BOTTLES", "BUN-BUNCHES", "CAN-CANS",
  "CBM-CUBIC METERS", "CCM-CUBIC CENTIMETERS", "CMS-CENTIMETERS", "CTN-CARTONS",
  "DOZ-DOZENS", "DRM-DRUMS", "GGK-GREAT GROSS", "GMS-GRAMMES", "GRS-GROSS",
  "GYD-GROSS YARDS", "KGS-KILOGRAMS", "KLR-KILOLITRE", "KME-KILOMETRE",
  "LTR-LITRES", "MLT-MILILITRE", "MTR-METERS", "MTS-METRIC TON", "NOS-NUMBERS",
  "OTH-OTHERS", "PAC-PACKS", "PCS-PIECES", "PRS-PAIRS", "QTL-QUINTAL",
  "ROL-ROLLS", "SET-SETS", "SQF-SQUARE FEET", "SQM-SQUARE METERS", 
  "SQY-SQUARE YARDS", "TBS-TABLETS", "TGM-TEN GROSS", "THD-THOUSANDS",
  "TON-TONNES", "TUB-TUBES", "UGS-US GALLONS", "YDS-YARDS"
];

type ItemForm = {
  name: string;
  alias: string;
  type: "Goods" | "Services";
  hsn_code: string;
  uom_id: string;
  default_price: number;
  is_gst_applicable: boolean;
  taxability: "Taxable" | "Nil Rated" | "Exempt" | "Zero Rated" | "Non-GST";
  igst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  opening_quantity: number;
  opening_rate: number;
  opening_value: number;
  is_active: boolean;
};



const EMPTY_UOM: UomForm = {
  name: "",
  formal_name: "",
  uqc_code: "Not Applicable",
  decimal_places: 0,
};

const EMPTY_HSN: HsnForm = {
  hsn_code: "",
  description: "",
  code_type: "goods",
  is_active: true,
};

const EMPTY_ITEM: ItemForm = {
  name: "",
  alias: "",
  type: "Goods",
  hsn_code: "",
  uom_id: "",
  default_price: 0,
  is_gst_applicable: true,
  taxability: "Taxable",
  igst_rate: 0,
  cgst_rate: 0,
  sgst_rate: 0,
  opening_quantity: 0,
  opening_rate: 0,
  opening_value: 0,
  is_active: true,
};

const SECTION_COPY: Record<SectionKey, { title: string; description: string }> = {
  items: {
    title: "Item masters",
    description: "Create and maintain billing-ready items with GST defaults, opening balances, and unit mapping.",
  },

  uom: {
    title: "Units of measure",
    description: "Define quantity units once and reuse them cleanly across vouchers and stock views.",
  },
  hsn: {
    title: "HSN codes",
    description: "Manage Harmonized System of Nomenclature (HSN) codes for accurate tax filing.",
  },
};

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/85 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 ${props.className || ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${props.className || ""}`}
    />
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-emerald-200"
    >
      <span>{label}</span>
      <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${checked ? "bg-emerald-500" : "bg-slate-200"}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function TogglePill({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
        checked ? "bg-emerald-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function InventorySectionPage() {
  const params = useParams<{ section: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const section = (params.section || "items") as SectionKey;
  const { activeFirmId, supabase } = useFirmScope();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    selectedIds,
    isSelectionMode,
    toggleSelection,
    clearSelection,
    enterSelectionMode,
  } = useSelection();

  // (Moved searchParams logic into the section useEffect below)

  const { data: itemData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", activeFirmId],
    queryFn: () =>
      apiRequest<ItemDetail[]>(supabase, "/api/items", {
        query: { firm_id: activeFirmId, active_only: false },
      }),
    enabled: !!activeFirmId && section === "items",
  });

  const { data: uomData, isLoading: uomLoading } = useQuery({
    queryKey: ["uom", activeFirmId],
    queryFn: async () => {
      return apiRequest<Uom[]>(supabase, "/api/uom", {
        query: { firm_id: activeFirmId },
      });
    },
    enabled: !!activeFirmId && (section === "items" || section === "uom"),
  });

  const { data: hsnData, isLoading: hsnLoading } = useQuery({
    queryKey: ["hsn", activeFirmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hsn_codes")
        .select("*")
        .eq("firm_id", activeFirmId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeFirmId && section === "hsn",
  });

  const rawItems = itemData || [];
  const rawUom = uomData || [];
  const rawHsn = hsnData || [];

  const items = useMemo(() => 
    rawItems.filter(item => item.name.toLowerCase().includes(search.toLowerCase())), 
  [rawItems, search]);

  const uom = useMemo(() => 
    rawUom.filter(u => u.name.toLowerCase().includes(search.toLowerCase())), 
  [rawUom, search]);

  const hsn = useMemo(() => 
    rawHsn.filter(h => 
      h.hsn_code.toLowerCase().includes(search.toLowerCase()) || 
      (h.description && h.description.toLowerCase().includes(search.toLowerCase()))
    ), 
  [rawHsn, search]);

  const isLoading = itemsLoading || uomLoading || hsnLoading;

  const [editingId, setEditingId] = useState<string | null>(null);

  const [hsnForm, setHsnForm] = useState<HsnForm>(EMPTY_HSN);
  const [uomForm, setUomForm] = useState<UomForm>(EMPTY_UOM);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Draft management state
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // ── Draft Management ──
  useEffect(() => {
    if (!activeFirmId || section !== "items") {
      setIsDraftLoaded(true);
      return;
    }

    if (!isDraftLoaded) {
      const draftStr = sessionStorage.getItem(`draft-item-form-${activeFirmId}`);
      
      // Only restore draft if we are returning from a sub-creation screen
      // or if we have a search param (came from + create link in voucher)
      const hasReturnTo = searchParams?.has("returnTo");
      const hasSearch = searchParams?.has("search");
      
      if (draftStr && (hasReturnTo || hasSearch)) {
        try {
          const parsed = JSON.parse(draftStr);
          if (parsed.itemForm) setItemForm(parsed.itemForm);
          if (parsed.editingId !== undefined) setEditingId(parsed.editingId);
          if (parsed.isFormOpen !== undefined) setIsFormOpen(parsed.isFormOpen);
          if (parsed.openingStockOpen !== undefined) setOpeningStockOpen(parsed.openingStockOpen);
        } catch (e) {
          // ignore corrupted draft
        }
      } else {
        // If we didn't return from somewhere, clear any stale draft
        sessionStorage.removeItem(`draft-item-form-${activeFirmId}`);
        
        // Handle normal search param prefill if no draft was used
        if (hasSearch && !draftStr) {
          setItemForm((prev) => ({ ...EMPTY_ITEM, name: searchParams.get("search") || "" }));
          setIsFormOpen(true);
        }
      }
      setIsDraftLoaded(true);
    }
  }, [activeFirmId, section, searchParams, isDraftLoaded]);

  function saveDraft() {
    if (!activeFirmId || section !== "items") return;
    sessionStorage.setItem(`draft-item-form-${activeFirmId}`, JSON.stringify({
      itemForm,
      editingId,
      isFormOpen,
      openingStockOpen
    }));
  }

  function clearDraft() {
    if (activeFirmId) {
      sessionStorage.removeItem(`draft-item-form-${activeFirmId}`);
    }
  }

  async function handleMakeInactive(id: string) {
    try {
      await apiRequest<ItemDetail>(supabase, `/api/items/${id}`, {
        method: "PATCH",
        body: { is_active: false },
      });
      showToast("Item made inactive successfully!", "success");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to make item inactive", "error");
    }
  }

  const copy = SECTION_COPY[section] || { title: "Inventory", description: "" };

  const deleteTargetInUse = useMemo(() => {
    if (!deleteTarget) return false;
    if (section === "uom") {
      return items.some((item) => item.uom_id === deleteTarget.id);
    }
    return false;
  }, [deleteTarget, section, items]);

  const referencingItems = useMemo(() => {
    if (!deleteTarget || section !== "uom") return [];
    return items
      .filter((item) => item.uom_id === deleteTarget.id)
      .map((item) => item.name);
  }, [deleteTarget, section, items]);

  function resetForms() {
    setEditingId(null);
    setHsnForm(EMPTY_HSN);
    setUomForm(EMPTY_UOM);
    setItemForm(EMPTY_ITEM);
    setOpeningStockOpen(false);
    setIsFormOpen(false);
    clearDraft();
  }

  function handleReturn() {
    const returnTo = searchParams?.get("returnTo");
    if (returnTo) {
      router.push(returnTo);
    } else {
      resetForms();
    }
  }

  useEffect(() => {
    // Only reset if we haven't loaded a draft for items, or if we switched sections
    if (section !== "items" || (!searchParams?.has("returnTo") && !searchParams?.has("search"))) {
        resetForms();
    }
    setSearch("");
    clearSelection();
  }, [section]);

  function handleIgstChange(value: number) {
    const half = parseFloat((value / 2).toFixed(2));
    setItemForm((prev) => ({
      ...prev,
      igst_rate: value,
      cgst_rate: half,
      sgst_rate: half,
    }));
  }

  async function saveUom() {
    if (!activeFirmId) return;
    if (!uomForm.name.trim() || !uomForm.uqc_code.trim()) {
      showToast("Please provide a UOM name and UQC code.", "error");
      return;
    }
    const body = { ...uomForm, firm_id: activeFirmId };
    try {
      if (editingId) {
        await apiRequest<Uom>(supabase, `/api/uom/${editingId}`, { method: "PATCH", body });
        showToast("UOM updated successfully!", "success");
      } else {
        await apiRequest<Uom>(supabase, "/api/uom/", { method: "POST", body });
        showToast("UOM created successfully!", "success");
      }
      handleReturn();
      void queryClient.invalidateQueries({ queryKey: ["uom"] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save UOM", "error");
    }
  }

  async function saveItem() {
    if (!activeFirmId) return;
    if (!itemForm.name.trim() || !itemForm.hsn_code || !itemForm.uom_id) {
      showToast("Please provide an item name, HSN code, and Unit of Measure.", "error");
      return;
    }
    const hsnLen = itemForm.hsn_code.length;
    if (![2, 4, 6, 8].includes(hsnLen)) {
      showToast("HSN code must be exactly 2, 4, 6, or 8 digits.", "error");
      return;
    }
    const body = { ...itemForm, firm_id: activeFirmId };
    try {
      if (editingId) {
        await apiRequest<ItemDetail>(supabase, `/api/items/${editingId}`, { method: "PATCH", body });
        showToast("Item updated successfully!", "success");
      } else {
        await apiRequest<ItemDetail>(supabase, "/api/items/", { method: "POST", body });
        showToast("Item created successfully!", "success");
      }
      handleReturn();
      void queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save item", "error");
    }
  }

  async function removeCurrent(id: string) {
    try {
      const path = section === "uom" ? `/api/uom/${id}` : `/api/items/${id}`;
      await apiRequest<void>(supabase, path, { method: "DELETE" });
      showToast(`${section === "uom" ? "UOM" : "Item"} deleted successfully!`, "success");
      if (editingId === id) resetForms();
      void queryClient.invalidateQueries({ queryKey: [section] });
    } catch (err) {
      let errMsg = "Failed to delete item";
      if (err instanceof Error) {
        if (err.message.includes("violates foreign key constraint") || err.message.includes("23503")) {
          errMsg = `Cannot delete this ${section === "uom" ? "UOM" : "item"} because it is currently used in vouchers. You can disable it by editing and unchecking "Keep active" instead.`;
        } else {
          errMsg = err.message;
        }
      }
      showToast(errMsg, "error");
    }
  }

  async function handleBulkDelete() {
    if (!activeFirmId || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const endpoint = section === "uom" ? "/api/uom/bulk-delete" : "/api/items/bulk-delete";
      const { data, error } = await supabase.auth.getSession();
      if (!data.session) throw new Error("No session");
      
      const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      if (!res.ok) throw new Error(`Failed to delete selected ${section}`);
      const result = await res.json();
      
      if (result.success?.length) {
        showToast(`Successfully deleted ${result.success.length} items.`, "success");
      }
      if (result.failed?.length) {
        showToast(`Failed to delete ${result.failed.length} items. They might be in use.`, "error");
      }
      
      clearSelection();
      void queryClient.invalidateQueries({ queryKey: [section] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk delete failed", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const editor = section === "uom"
      ? (
        <SurfaceCard
          title={editingId ? "Edit UOM" : "Add UOM"}
          description="Define the GST-ready unit once and keep quantity entry consistent everywhere."
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <TextInput
              placeholder="Type"
              value="Simple"
              disabled
              readOnly
            />
            <TextInput
              placeholder="Symbol (e.g. pcs)"
              value={uomForm.name}
              onChange={(event) => setUomForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <div className="md:col-span-2">
              <TextInput
                placeholder="Formal name (e.g. Pieces)"
                value={uomForm.formal_name}
                onChange={(event) => setUomForm((prev) => ({ ...prev, formal_name: event.target.value }))}
              />
            </div>
            <div className="relative md:col-span-2">
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                value={uomForm.uqc_code}
                onChange={(event) => setUomForm((prev) => ({ ...prev, uqc_code: event.target.value }))}
              >
                <option value="" disabled>Select Unit Quantity Code (UQC)</option>
                {GST_UQCS.map((uqc) => (
                  <option key={uqc} value={uqc}>{uqc}</option>
                ))}
              </select>
            </div>
            <TextInput
              type="number"
              placeholder="Number of decimal places"
              value={uomForm.decimal_places}
              onChange={(event) => setUomForm((prev) => ({ ...prev, decimal_places: Number(event.target.value) }))}
            />
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => void saveUom()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              {editingId ? "Save changes" : "Create UOM"}
            </button>
            <button onClick={handleReturn} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600">
              Cancel
            </button>
          </div>
        </SurfaceCard>
      )
      : section === "items"
        ? (
          <SurfaceCard
            title={editingId ? "Edit item" : "Add item"}
            description={
              editingId
                ? "Update this item's identity, GST defaults, and opening stock."
                : "Define the item once — billing-ready across all vouchers."
            }
          >
            <div className="space-y-8">

              {/* ── IDENTITY ──────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Identity</p>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Item name <span className="text-rose-400">*</span>
                  </label>
                  <TextInput
                    placeholder="e.g. Washing Machine"
                    value={itemForm.name}
                    onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">Alias</label>
                    <TextInput
                      placeholder="Optional short name"
                      value={itemForm.alias}
                      onChange={(e) => setItemForm((p) => ({ ...p, alias: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">Type</label>
                    <div className="flex h-12 rounded-2xl bg-slate-100 p-1">
                      {(["Goods", "Services"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setItemForm((p) => ({ ...p, type: t }))}
                          className={`flex-1 rounded-xl text-sm font-semibold transition ${
                            itemForm.type === t
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-500">
                        HSN / SAC <span className="text-rose-400">*</span>
                      </label>
                    </div>
                    <TextInput
                      placeholder="e.g. 123456"
                      value={itemForm.hsn_code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setItemForm((p) => ({ ...p, hsn_code: val }));
                      }}
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-500">
                        Unit of Measure <span className="text-rose-400">*</span>
                      </label>
                      <Link 
                        href={`/dashboard/inventory/uom?firm_id=${activeFirmId}&returnTo=${encodeURIComponent(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ""))}`}
                        onClick={() => saveDraft()}
                        className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        + Add new
                      </Link>
                    </div>
                    <SelectInput value={itemForm.uom_id} onChange={(e) => setItemForm((p) => ({ ...p, uom_id: e.target.value }))}>
                      <option value="">Select unit</option>
                      {uom.map((row) => (
                        <option key={row.id} value={row.id}>{row.name} ({row.uqc_code})</option>
                      ))}
                    </SelectInput>
                  </div>
                </div>

                <div className="sm:max-w-[calc(50%-8px)]">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">Default price (₹)</label>
                  <TextInput
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={itemForm.default_price || ""}
                    onChange={(e) => setItemForm((p) => ({ ...p, default_price: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100" />

              {/* ── GST & TAXATION ────────────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">GST &amp; Taxation</p>
                    {itemForm.is_gst_applicable && (
                      <p className="mt-0.5 text-xs text-slate-400">IGST auto-splits into CGST + SGST</p>
                    )}
                  </div>
                  <TogglePill
                    checked={itemForm.is_gst_applicable}
                    onChange={(next) => setItemForm((p) => ({ ...p, is_gst_applicable: next }))}
                  />
                </div>

                {itemForm.is_gst_applicable && (
                  <div className="space-y-4 rounded-2xl bg-slate-50/70 p-4">

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Taxability</label>
                        <SelectInput
                          value={itemForm.taxability}
                          onChange={(e) => setItemForm((p) => ({ ...p, taxability: e.target.value as ItemForm["taxability"] }))}
                        >
                          <option value="Taxable">Taxable</option>
                          <option value="Nil Rated">Nil Rated</option>
                          <option value="Exempt">Exempt</option>
                          <option value="Zero Rated">Zero Rated</option>
                          <option value="Non-GST">Non-GST</option>
                        </SelectInput>
                      </div>
                    </div>

                    {itemForm.taxability === "Taxable" && (
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          GST rates — type IGST to auto-fill CGST &amp; SGST
                        </p>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">IGST %</label>
                            <TextInput
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={itemForm.igst_rate || ""}
                              onChange={(e) => handleIgstChange(Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">CGST %</label>
                            <TextInput
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={itemForm.cgst_rate || ""}
                              onChange={(e) => setItemForm((p) => ({ ...p, cgst_rate: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">SGST %</label>
                            <TextInput
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={itemForm.sgst_rate || ""}
                              onChange={(e) => setItemForm((p) => ({ ...p, sgst_rate: Number(e.target.value) }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* ── OPENING STOCK ─────────────────────────── */}
              <div>
                <button
                  type="button"
                  onClick={() => setOpeningStockOpen((p) => !p)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Opening Stock</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {openingStockOpen
                        ? "Collapse"
                        : "Expand to set opening quantity, rate, and value"}
                    </p>
                  </div>
                  <span
                    className={`text-lg leading-none text-slate-400 transition-transform duration-200 ${
                      openingStockOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {openingStockOpen && (
                  <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">Opening quantity</label>
                      <TextInput
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={itemForm.opening_quantity || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setItemForm((p) => ({ 
                            ...p, 
                            opening_quantity: val,
                            opening_value: parseFloat((val * p.opening_rate).toFixed(2))
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">Rate (₹ / unit)</label>
                      <TextInput
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemForm.opening_rate || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setItemForm((p) => ({ 
                            ...p, 
                            opening_rate: val,
                            opening_value: parseFloat((p.opening_quantity * val).toFixed(2))
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">Value (₹)</label>
                      <TextInput
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemForm.opening_value || ""}
                        onChange={(e) => setItemForm((p) => ({ ...p, opening_value: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100" />

              {/* ── STATUS & ACTIONS ──────────────────────── */}
              <div className="flex flex-col gap-5">
                <Toggle
                  checked={itemForm.is_active}
                  label="Keep item active"
                  onChange={(next) => setItemForm((p) => ({ ...p, is_active: next }))}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => void saveItem()}
                    className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                  >
                    {editingId ? "Save item" : "Create item"}
                  </button>
                  <button
                    onClick={handleReturn}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

            </div>
          </SurfaceCard>
        )
        : null;

  const content = section === "items"
    ? (
      <div className="space-y-3 pb-20">
        {items.length === 0 ? (
          <EmptyState title="No items yet" description="Create the first item so vouchers can pick inventory lines from a real master." />
        ) : items.map((item, index) => {
          return (
            <SelectionRow
              key={item.id}
              id={item.id}
              isSelected={selectedIds.has(item.id)}
              isSelectionMode={isSelectionMode}
              onToggle={toggleSelection}
              onLongPress={enterSelectionMode}
              autoFocus={index === 0}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between w-full">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-950">{item.name}</p>
                    {!item.is_active ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Inactive</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.hsn_code || "No HSN"} • {item.uom_name || "No UOM"} • {item.type}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Default price: {formatCurrency(item.default_price)}</span>
                    <span>Taxability: {item.taxability}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setItemForm({
                        name: item.name,
                        alias: item.alias || "",
                        type: item.type,
                        hsn_code: item.hsn_code || "",
                        uom_id: item.uom_id,
                        default_price: item.default_price,
                        is_gst_applicable: item.is_gst_applicable,
                        taxability: item.taxability,
                        igst_rate: item.igst_rate,
                        cgst_rate: item.cgst_rate,
                        sgst_rate: item.sgst_rate,
                        opening_quantity: item.opening_quantity,
                        opening_rate: item.opening_rate,
                        opening_value: item.opening_value,
                        is_active: item.is_active,
                      });
                      setIsFormOpen(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => setDeleteTarget({ id: item.id, name: item.name })} 
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </SelectionRow>
          );
        })}
      </div>
    )
    : section === "hsn"
      ? (
        <div className="space-y-3">
          {hsn.length === 0 ? <EmptyState title="No HSN / SAC codes yet" description="Add the statutory codes your item masters will reference." /> : hsn.map((row) => (
            <div key={row.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-white/92 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-950">{row.hsn_code}</p>
                <p className="mt-2 text-sm text-slate-500">{row.description || "No description"} • {row.code_type}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setEditingId(row.id); setHsnForm({ hsn_code: row.hsn_code, description: row.description || "", code_type: row.code_type, is_active: row.is_active }); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Edit</button>
                <button onClick={() => void removeCurrent(row.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )
      : section === "uom"
        ? (
          <div className="space-y-3 pb-20">
            {uom.length === 0 ? <EmptyState title="No UOM defined yet" description="Add the units that items and voucher quantity fields will use." /> : uom.map((row, index) => (
              <SelectionRow
                key={row.id}
                id={row.id}
                isSelected={selectedIds.has(row.id)}
                isSelectionMode={isSelectionMode}
                onToggle={toggleSelection}
                onLongPress={enterSelectionMode}
                autoFocus={index === 0}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-lg font-bold text-slate-950">{row.name}</p>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{row.uqc_code}</span>
                  </div>
                  <p className="text-sm text-slate-600">{row.formal_name || "No formal name defined"}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">{row.decimal_places} decimal places</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setEditingId(row.id); setUomForm({ name: row.name, formal_name: row.formal_name || "", uqc_code: row.uqc_code, decimal_places: row.decimal_places }); setIsFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors">Edit</button>
                  <button 
                    onClick={() => setDeleteTarget({ id: row.id, name: row.name })} 
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
                </div>
              </SelectionRow>
            ))}
          </div>
        )
        : null;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Inventory Detail"
        title={copy?.title || "Inventory"}
        description={copy?.description || "Manage your inventory"}
        backHref="/dashboard/inventory"
      />

      {!(isFormOpen && (section === "items" || section === "uom")) && (
        <SurfaceCard title="Find records" description="Search stays local to this working view so you can move quickly without jumping screens.">
          <TextInput placeholder={`Search ${section.replace("-", " ")}`} value={search} onChange={(event) => setSearch(event.target.value)} />
        </SurfaceCard>
      )}

      {isFormOpen && (section === "items" || section === "uom") ? (
        editor
      ) : (
        <SurfaceCard
          title={copy?.title || "Inventory"}
          description="Live records from the backend."
        >
          {(section === "items" || section === "uom") && !isLoading && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => { setIsFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                + Add {section === "items" ? "Item" : "UOM"}
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-[26px] border border-slate-100 bg-white/92 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-40 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1}s` }} />
                        <div className="h-5 w-16 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.02}s` }} />
                      </div>
                      <div className="h-4 w-48 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.04}s` }} />
                      <div className="flex gap-4 pt-1">
                        <div className="h-3 w-28 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.06}s` }} />
                        <div className="h-3 w-20 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.06}s` }} />
                        <div className="h-3 w-24 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.08}s` }} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-9 w-16 animate-shimmer-fast rounded-2xl" style={{ animationDelay: `${i * 0.1 + 0.08}s` }} />
                      <div className="h-9 w-20 animate-shimmer-fast rounded-2xl" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            content
          )}
        </SurfaceCard>
      )}
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        title={
          deleteTargetInUse
            ? section === "items"
              ? "Item is in Use"
              : "UOM is in Use"
            : `Delete ${section === "uom" ? "UOM" : "Item"}`
        }
        message={
          deleteTargetInUse
            ? section === "items"
              ? `"${deleteTarget?.name}" is currently referenced in vouchers and cannot be deleted. Would you like to make it inactive instead so it can't be selected in new transactions?`
              : `"${deleteTarget?.name}" is currently referenced by items: ${referencingItems.slice(0, 3).join(", ")}${referencingItems.length > 3 ? " and others" : ""}. You must update or delete those items before you can delete this UOM.`
            : `Are you sure you want to delete the ${section === "uom" ? "UOM" : "item"} "${deleteTarget?.name}"? This action cannot be undone.`
        }
        confirmLabel={
          deleteTargetInUse
            ? section === "items"
              ? "Make Inactive"
              : undefined
            : "Delete"
        }
        cancelLabel={deleteTargetInUse && section === "uom" ? "Close" : "Cancel"}
        onConfirm={async () => {
          if (deleteTarget) {
            if (deleteTargetInUse) {
              if (section === "items") {
                await handleMakeInactive(deleteTarget.id);
              }
            } else {
              await removeCurrent(deleteTarget.id);
              setDeleteTarget(null);
            }
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        isDanger={!deleteTargetInUse}
      />
      
      {(section === "items" || section === "uom") && (
        <SelectionActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
