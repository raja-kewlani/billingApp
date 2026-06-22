"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { LedgerDetail } from "@/interfaces/ledger";
import { RegisterRow } from "@/interfaces/workspace";
import { getApiBaseUrl } from "@/lib/api";
import { apiRequest } from "@/lib/http";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/context/ToastContext";
import { exportRegisterPdf } from "@/lib/pdfExport";

import { EmptyState, PageHero, SurfaceCard } from "../../shared/WorkspaceUi";
import { useFirmScope } from "../../shared/useFirmScope";
import { useDateFilter } from "@/context/DateFilterContext";
import { useSelection } from "../../shared/useSelection";
import SelectionRow from "../../shared/SelectionRow";
import SelectionActionBar from "../../shared/SelectionActionBar";

const BOOK_LABELS: Record<string, { title: string; description: string }> = {
  "sales-register": {
    title: "Sales Register",
    description: "Review live sales vouchers with party and amount context.",
  },
  "purchase-register": {
    title: "Purchase Register",
    description: "Monitor inward invoices and supplier-facing voucher activity.",
  },
  "receipt-register": {
    title: "Receipt Register",
    description: "Track all incoming payments and receipts.",
  },
  "payment-register": {
    title: "Payment Register",
    description: "Track all outgoing payments and disbursements.",
  },
  "journal-register": {
    title: "Journal Register",
    description: "Review journal entries and adjustment vouchers.",
  },
  "contra-register": {
    title: "Contra Register",
    description: "Monitor internal cash and bank transfers.",
  },
  "debit-note-register": {
    title: "Debit Note Register",
    description: "Track debit notes issued to suppliers or customers.",
  },
  "credit-note-register": {
    title: "Credit Note Register",
    description: "Track credit notes issued to customers or suppliers.",
  },
  "day-book": {
    title: "Day Book",
    description: "Chronological voucher stream for the active firm.",
  },
  "cash-book": {
    title: "Cash Book",
    description: "Operational vouchers touching cash and bank ledgers.",
  },
  ledger: {
    title: "Ledger",
    description: "Account masters with their group and configuration details.",
  },
};

export default function BookDetailPage() {
  const params = useParams<{ bookSlug: string }>();
  const bookSlug = params.bookSlug;
  const { activeFirmId, supabase } = useFirmScope();
  const { fromDate, toDate } = useDateFilter();
  const { showToast } = useToast();
  const [exportingLedgerId, setExportingLedgerId] = useState<string | null>(null);
  const [isExportingBook, setIsExportingBook] = useState(false);
  const [isExportingBookPdf, setIsExportingBookPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const {
    selectedIds,
    isSelectionMode,
    toggleSelection,
    clearSelection,
    enterSelectionMode,
  } = useSelection();

  const copy = BOOK_LABELS[bookSlug] || BOOK_LABELS["day-book"];

  const { data: ledgers = [], isLoading: ledgersLoading } = useQuery({
    queryKey: ["ledgers", activeFirmId],
    queryFn: () =>
      apiRequest<LedgerDetail[]>(supabase, "/api/ledgers/", {
        query: { firm_id: activeFirmId },
      }),
    enabled: !!activeFirmId && bookSlug === "ledger",
  });

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ["register", bookSlug, activeFirmId, fromDate, toDate],
    queryFn: () =>
      apiRequest<RegisterRow[]>(supabase, `/api/workspace/books/${bookSlug}`, {
        query: { firm_id: activeFirmId, from_date: fromDate, to_date: toDate },
      }),
    enabled: !!activeFirmId && bookSlug !== "ledger",
  });

  const queryClient = useQueryClient();

  const isLoading = ledgersLoading || rowsLoading;

  const filteredLedgers = useMemo(() => {
    if (!search.trim()) return ledgers;
    const lower = search.toLowerCase();
    return ledgers.filter((l) => 
      l.name.toLowerCase().includes(lower) || 
      (l.group_name && l.group_name.toLowerCase().includes(lower))
    );
  }, [ledgers, search]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const lower = search.toLowerCase();
    return rows.filter((r) => 
      (r.voucher_number && r.voucher_number.toLowerCase().includes(lower)) ||
      (r.party_name && r.party_name.toLowerCase().includes(lower)) ||
      (r.primary_ledger_name && r.primary_ledger_name.toLowerCase().includes(lower))
    );
  }, [rows, search]);

  async function downloadXlsx(url: string, downloadName: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("No active session");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  async function exportLedgerExcel(ledger: LedgerDetail) {
    if (!activeFirmId) return;
    setExportingLedgerId(ledger.id);
    try {
      const url = new URL(`${getApiBaseUrl()}/api/ledgers/${ledger.id}/statement/export`);
      url.searchParams.set("firm_id", activeFirmId);
      const downloadName = `${ledger.name.replace(/[^A-Za-z0-9._-]+/g, "_")}-statement.xlsx`;
      await downloadXlsx(url.toString(), downloadName);
      showToast(`${ledger.name} exported to Excel`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to export ledger", "error");
    } finally {
      setExportingLedgerId(null);
    }
  }

  async function exportBookExcel(isTally: boolean = false) {
    if (!activeFirmId || bookSlug === "ledger") return;
    
    // Automatically use Tally format for Sales Register if requested
    if (bookSlug === "sales-register") {
      isTally = true;
    }
    
    setIsExportingBook(true);
    try {
      const url = new URL(`${getApiBaseUrl()}/api/workspace/books/${bookSlug}/export`);
      url.searchParams.set("firm_id", activeFirmId);
      if (isTally) {
        url.searchParams.set("format", "tally");
      }
      if (fromDate) url.searchParams.set("from_date", fromDate);
      if (toDate) url.searchParams.set("to_date", toDate);
      
      console.log("EXPORTING URL:", url.toString());
      
      const downloadName = `${bookSlug.replace(/[^A-Za-z0-9._-]+/g, "_")}-export${isTally ? "-tally" : ""}.xlsx`;
      await downloadXlsx(url.toString(), downloadName);
      showToast(`${copy.title} exported to Excel${isTally ? " (Tally Format)" : ""}`, "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast(error instanceof Error ? error.message : "Unable to export register", "error");
    } finally {
      setIsExportingBook(false);
    }
  }

  async function exportBookPdf() {
    if (!activeFirmId || bookSlug === "ledger" || rows.length === 0) return;
    setIsExportingBookPdf(true);
    try {
      // Fetch firm details for the PDF header
      const { data: firmData } = await supabase
        .from("firms")
        .select("name, mailing_name, address_lane1, city, state, pincode")
        .eq("id", activeFirmId)
        .single();

      const firm = firmData
        ? {
            name: firmData.name || "",
            mailingName: firmData.mailing_name || firmData.name || "",
            address: [firmData.address_lane1, firmData.city, firmData.state, firmData.pincode]
              .filter(Boolean)
              .join(", "),
          }
        : { name: "" };

      exportRegisterPdf({
        firm,
        registerTitle: copy.title,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        rows: rows.map((r) => ({
          voucher_date: r.voucher_date,
          voucher_number: r.voucher_number,
          category: r.category,
          party_name: r.party_name,
          primary_ledger_name: r.primary_ledger_name,
          narration: r.narration,
          amount: r.amount,
        })),
        filename: `${copy.title.replace(/[^A-Za-z0-9]/g, "_")}.pdf`,
      });
      showToast(`${copy.title} exported to PDF`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to export PDF", "error");
    } finally {
      setIsExportingBookPdf(false);
    }
  }

  async function handleBulkDelete() {
    if (!activeFirmId || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const endpoint = bookSlug === "ledger" ? "/api/ledgers/bulk-delete" : "/api/vouchers/bulk-delete";
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
      
      if (!res.ok) throw new Error("Failed to delete selected items");
      const result = await res.json();
      
      if (result.success?.length) {
        showToast(`Successfully deleted ${result.success.length} items.`, "success");
      }
      if (result.failed?.length) {
        showToast(`Failed to delete ${result.failed.length} items. They might be in use.`, "error");
      }
      
      clearSelection();
      void queryClient.invalidateQueries({ queryKey: bookSlug === "ledger" ? ["ledgers"] : ["register"] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk delete failed", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Book Detail" title={copy.title} description={copy.description} backHref="/dashboard/books" />
      {bookSlug !== "ledger" ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => exportBookExcel()}
            disabled={isExportingBook || rows.length === 0}
            className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportingBook ? "Exporting..." : (bookSlug === "sales-register" ? "Export Tally Excel" : "Export Excel")}
          </button>
          <button
            type="button"
            onClick={exportBookPdf}
            disabled={isExportingBookPdf || rows.length === 0}
            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportingBookPdf ? "Generating..." : "Export PDF"}
          </button>
        </div>
      ) : null}

      {!isLoading && (bookSlug === "ledger" ? ledgers.length > 0 : rows.length > 0) && (
        <SurfaceCard title="Find records" description="Search stays local to this working view so you can move quickly without jumping screens.">
          <input
            type="text"
            placeholder={`Search ${copy.title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/85 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
          />
        </SurfaceCard>
      )}

      <SurfaceCard title={copy.title} description="Live rows from the operational backend.">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-100 bg-white/92 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-32 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1}s` }} />
                      <div className="h-5 w-16 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.02}s` }} />
                    </div>
                    <div className="h-4 w-48 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.04}s` }} />
                    <div className="h-3 w-64 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.06}s` }} />
                  </div>
                  <div className="h-6 w-24 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.08}s` }} />
                </div>
              </div>
            ))}
          </div>
        ) : bookSlug === "ledger" ? (
          filteredLedgers.length === 0 ? (
            <EmptyState title={search ? "No matches found" : "No ledgers yet"} description={search ? "Try adjusting your search terms." : "Create ledgers first so books and voucher selectors have something real to work with."} />
          ) : (
            <div className="space-y-3 pb-20">
              {filteredLedgers.map((ledger, index) => (
                <SelectionRow
                  key={ledger.id}
                  id={ledger.id}
                  isSelected={selectedIds.has(ledger.id)}
                  isSelectionMode={isSelectionMode}
                  onToggle={toggleSelection}
                  onLongPress={enterSelectionMode}
                  autoFocus={index === 0}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between w-full">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{ledger.name}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {ledger.group_name || "Ungrouped"} {ledger.group_parent_name ? `• ${ledger.group_parent_name}` : ""} • {ledger.template_type}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600 sm:justify-end">
                        <span>Opening: {formatCurrency(ledger.opening_balance)}</span>
                        <span>{ledger.opening_balance_type}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/books/ledger-statement/${ledger.id}`}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100"
                        >
                          View ledger
                        </Link>
                        <button
                          type="button"
                          onClick={() => exportLedgerExcel(ledger)}
                          disabled={exportingLedgerId === ledger.id}
                          className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {exportingLedgerId === ledger.id ? "Exporting..." : "Export Excel"}
                        </button>
                        <Link
                          href={`/dashboard/create/ledger?ledger_id=${ledger.id}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit ledger
                        </Link>
                      </div>
                    </div>
                  </div>
                </SelectionRow>
              ))}
            </div>
          )
        ) : filteredRows.length === 0 ? (
          <EmptyState title={search ? "No matches found" : "No entries yet"} description={search ? "Try adjusting your search terms." : "Once vouchers are created, this book will start filling with live rows."} />
        ) : (
          <div className="space-y-3 pb-20">
            {filteredRows.map((row, index) => (
              <SelectionRow
                key={row.id}
                id={row.id}
                isSelected={selectedIds.has(row.id)}
                isSelectionMode={isSelectionMode}
                onToggle={toggleSelection}
                onLongPress={enterSelectionMode}
                onClickHref={`/dashboard/vouchers/${row.id}`}
                autoFocus={index === 0}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-950">{row.voucher_number}</p>
                      <span className="rounded-full bg-tally-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tally-700">
                        {row.category}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {row.party_name || row.primary_ledger_name || "Voucher detail"} • {formatDate(row.voucher_date)}
                    </p>
                    {row.narration ? <p className="mt-2 text-sm text-slate-500">{row.narration}</p> : null}
                  </div>
                  <p className="text-lg font-semibold text-slate-950">{formatCurrency(row.amount)}</p>
                </div>
              </SelectionRow>
            ))}
          </div>
        )}
      </SurfaceCard>
      
      <SelectionActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
