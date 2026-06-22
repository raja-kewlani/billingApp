"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { useToast } from "@/context/ToastContext";
import { LedgerStatement as LedgerStatementData } from "@/interfaces/ledger";
import { getApiBaseUrl } from "@/lib/api";
import { apiRequest } from "@/lib/http";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportLedgerStatementPdf } from "@/lib/pdfExport";

import { EmptyState, MetricTile, PageHero, SurfaceCard } from "../../../shared/WorkspaceUi";
import { useFirmScope } from "../../../shared/useFirmScope";
import { useDateFilter } from "@/context/DateFilterContext";
import { DatePicker } from "../../../components/DatePicker";

function formatBalance(amount: number, balanceType: string) {
  return `${balanceType} ${formatCurrency(amount)}`;
}

export default function LedgerStatementPage() {
  const params = useParams<{ ledgerId: string }>();
  const ledgerId = params.ledgerId;
  const { activeFirmId, supabase } = useFirmScope();
  const { fromDate: globalFromDate, toDate: globalToDate } = useDateFilter();
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  const [filters, setFilters] = useState({ fromDate: globalFromDate, toDate: globalToDate });
  const [appliedFilters, setAppliedFilters] = useState({ fromDate: globalFromDate, toDate: globalToDate });

  useEffect(() => {
    // Sync filters if global changes and we haven't touched local ones
    setFilters({ fromDate: globalFromDate, toDate: globalToDate });
    setAppliedFilters({ fromDate: globalFromDate, toDate: globalToDate });
  }, [globalFromDate, globalToDate]);

  const { data: statement, isLoading } = useQuery({
    queryKey: ["ledger-statement", ledgerId, activeFirmId, appliedFilters.fromDate, appliedFilters.toDate],
    queryFn: () =>
      apiRequest<LedgerStatementData>(supabase, `/api/ledgers/${ledgerId}/statement`, {
        query: {
          firm_id: activeFirmId,
          from_date: appliedFilters.fromDate || undefined,
          to_date: appliedFilters.toDate || undefined,
        },
      }),
    enabled: !!activeFirmId && !!ledgerId,
  });

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function clearFilters() {
    const emptyFilters = { fromDate: globalFromDate, toDate: globalToDate };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  async function exportLedgerExcel() {
    if (!ledgerId || !activeFirmId) return;
    setIsExporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const url = new URL(`${getApiBaseUrl()}/api/ledgers/${ledgerId}/statement/export`);
      url.searchParams.set("firm_id", activeFirmId);
      if (appliedFilters.fromDate) url.searchParams.set("from_date", appliedFilters.fromDate);
      if (appliedFilters.toDate) url.searchParams.set("to_date", appliedFilters.toDate);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadName = `${(statement?.ledger.name || "ledger").replace(/[^A-Za-z0-9._-]+/g, "_")}-statement.xlsx`;
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast("Ledger exported to Excel", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to export ledger", "error");
    } finally {
      setIsExporting(false);
    }
  }

  async function exportLedgerPdf() {
    if (!statement || !activeFirmId) return;
    setIsExportingPdf(true);
    try {
      // Fetch firm details for the header
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

      const ledger = statement.ledger;

      // Build book label — for bank ledgers show "[NAME]  Book", for cash use "Cash Book"
      const isBank = ledger.template_type === "bank";
      const isCash = (ledger.group_name || "").toLowerCase().includes("cash");
      let bookLabel = `${ledger.name}  Book`;
      if (isCash) bookLabel = "Cash  Book";

      // Build ledger subtitle (bank address if available)
      let ledgerSubtitle: string | undefined;
      if (isBank && ledger.bank_details) {
        const bd = ledger.bank_details;
        ledgerSubtitle = [bd.bank_name, bd.branch_name, bd.account_number]
          .filter(Boolean)
          .join("\n");
      } else if (!isBank && !isCash) {
        // Party ledger — show address if available
        const pd = ledger.party_details;
        if (pd?.address) ledgerSubtitle = pd.address;
      }

      exportLedgerStatementPdf({
        firm,
        ledgerName: ledger.name,
        bookLabel,
        ledgerSubtitle,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        openingBalance: statement.opening_balance,
        openingBalanceType: statement.opening_balance_type,
        closingBalance: statement.closing_balance,
        closingBalanceType: statement.closing_balance_type,
        totalDebit: statement.total_debit,
        totalCredit: statement.total_credit,
        rows: statement.rows.map((r) => ({
          voucher_date: r.voucher_date,
          category: r.category,
          particulars: r.particulars,
          voucher_number: r.voucher_number,
          debit_amount: r.debit_amount,
          credit_amount: r.credit_amount,
        })),
        filename: `${ledger.name.replace(/[^A-Za-z0-9]/g, "_")}_statement.pdf`,
      });
      showToast("Ledger exported to PDF", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to export PDF", "error");
    } finally {
      setIsExportingPdf(false);
    }
  }

  const openingBalanceLabel = statement ? formatBalance(statement.opening_balance, statement.opening_balance_type) : "";
  const closingBalanceLabel = statement ? formatBalance(statement.closing_balance, statement.closing_balance_type) : "";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Ledger Statement"
        title={statement?.ledger.name || "Ledger"}
        description={statement ? `${statement.ledger.group_name || "Ungrouped"}${statement.ledger.group_parent_name ? ` • ${statement.ledger.group_parent_name}` : ""} • ${statement.ledger.template_type}` : "View the running Dr and Cr movement for this party ledger."}
        backHref="/dashboard/books/ledger"
      >
        <div className="flex flex-wrap gap-2">
          {ledgerId ? (
            <Link
              href={`/dashboard/create/ledger?ledger_id=${ledgerId}`}
              className="rounded-full border border-white/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition hover:bg-slate-50"
            >
              Edit ledger
            </Link>
          ) : null}
          <button
            type="button"
            onClick={exportLedgerExcel}
            disabled={!statement || isExporting}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={exportLedgerPdf}
            disabled={!statement || isExportingPdf}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportingPdf ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </PageHero>

      <SurfaceCard
        title="Balance summary"
        description="Opening balance and the current running position for the selected ledger."
      >
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-[24px] border border-slate-100 bg-white/90 p-4 shadow-sm">
                <div className="h-3.5 w-24 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.15}s` }} />
                <div className="mt-3.5 h-8 w-32 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.15 + 0.05}s` }} />
                <div className="mt-2.5 h-3.5 w-40 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.15 + 0.1}s` }} />
              </div>
            ))}
          </div>
        ) : statement ? (
          <div className="grid gap-4 md:grid-cols-3">
            <MetricTile label="Opening balance" value={openingBalanceLabel} helper="Carried forward from the ledger master." />
            <MetricTile label="Current balance" value={closingBalanceLabel} helper="After applying all posted voucher lines." />
            <MetricTile label="Total movement" value={formatCurrency(statement.total_debit + statement.total_credit)} helper="Combined Dr and Cr activity in the visible range." />
          </div>
        ) : (
          <EmptyState title="No statement loaded" description="Select a ledger from Books to inspect its voucher movement." />
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Ledger rows"
        description="Date-wise voucher movement with debit, credit, particulars, and a live running balance."
      >
        {isLoading ? (
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Voucher</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Particulars</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dr</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cr</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...Array(4)].map((_, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-4"><div className="h-4 w-16 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1}s` }} /></td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="h-4 w-20 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.02}s` }} />
                          <div className="h-3 w-16 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.04}s` }} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="h-4 w-48 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.02}s` }} />
                          <div className="h-3 w-32 animate-shimmer-fast rounded-full" style={{ animationDelay: `${i * 0.1 + 0.04}s` }} />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right"><div className="h-4 w-16 animate-shimmer-fast rounded-full ml-auto" style={{ animationDelay: `${i * 0.1 + 0.06}s` }} /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 w-16 animate-shimmer-fast rounded-full ml-auto" style={{ animationDelay: `${i * 0.1 + 0.06}s` }} /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 w-20 animate-shimmer-fast rounded-full ml-auto" style={{ animationDelay: `${i * 0.1 + 0.08}s` }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : statement ? (
          <div className="space-y-4">
            <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                From date
                <DatePicker
                  value={filters.fromDate}
                  minDate={globalFromDate}
                  maxDate={globalToDate}
                  onChange={(val) => setFilters((prev) => ({ ...prev, fromDate: val }))}
                  className="!py-0 h-11"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                To date
                <DatePicker
                  value={filters.toDate}
                  minDate={globalFromDate}
                  maxDate={globalToDate}
                  onChange={(val) => setFilters((prev) => ({ ...prev, toDate: val }))}
                  className="!py-0 h-11"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="h-11 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 flex-1 md:flex-initial"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 flex-1 md:flex-initial"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/90">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Voucher</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Particulars</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dr</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cr</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-emerald-50/40">
                      <td className="px-4 py-3 text-sm font-medium text-slate-500">Opening</td>
                      <td className="px-4 py-3 text-sm text-slate-400">-</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">Opening balance</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-400">-</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-400">-</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{openingBalanceLabel}</td>
                    </tr>
                    {statement.rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-sm text-slate-500" colSpan={6}>
                          No posted voucher lines yet for this ledger.
                        </td>
                      </tr>
                    ) : (
                      statement.rows.map((row) => (
                        <tr key={row.voucher_id} className="align-top hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.voucher_date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            <div className="flex flex-col gap-1">
                              <span>{row.voucher_number}</span>
                              <span className="w-fit rounded-full bg-tally-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tally-700">
                                {row.category}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm leading-6 text-slate-600">
                            <p className="font-medium text-slate-800">{row.particulars}</p>
                            {row.narration && row.narration !== row.particulars ? (
                              <p className="mt-1 text-xs leading-5 text-slate-400">{row.narration}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                            {row.debit_amount > 0 ? formatCurrency(row.debit_amount) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                            {row.credit_amount > 0 ? formatCurrency(row.credit_amount) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatBalance(row.balance_amount, row.balance_type)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t border-slate-100 bg-slate-50/80">
                    <tr>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900" colSpan={3}>
                        Closing balance
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(statement.total_debit)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(statement.total_credit)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {closingBalanceLabel}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No ledger activity" description="This ledger does not yet have posted vouchers, so the statement is empty aside from opening balance." />
        )}
      </SurfaceCard>
    </div>
  );
}
