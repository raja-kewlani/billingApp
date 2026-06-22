import { Dispatch, SetStateAction } from "react";
import { BillAllocationState, FormState, VoucherFamily } from "../types";
import { LedgerDetail } from "@/interfaces/ledger";
import { VoucherCategory } from "@/interfaces/voucher";
import { ComboboxField } from "../../ComboboxField";

type VoucherPartySectionProps = {
  meta: { family: VoucherFamily; category: VoucherCategory };
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  cashBankLedgers: { value: string; label: string }[];
  partyLedgers: { value: string; label: string }[];
  mainLedgers: { value: string; label: string }[];
  allLedgerOptions: { value: string; label: string }[];
  selectedPartyLedger: LedgerDetail | null | undefined;
  taxMode: "intra" | "inter";
  readOnly: boolean;
  onOpenBillWise?: () => void;
  onPartySelected?: () => void;
};

export function VoucherPartySection({
  meta,
  form,
  setForm,
  cashBankLedgers,
  partyLedgers,
  mainLedgers,
  allLedgerOptions,
  selectedPartyLedger,
  taxMode,
  readOnly,
  onOpenBillWise,
  onPartySelected,
}: VoucherPartySectionProps) {
  const partyHasBillByBill = selectedPartyLedger?.party_details?.maintain_bill_by_bill === true;
  if (meta.family === "payment") {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Account Bar (Tally style) */}
        <div className="shrink-0 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50/80">
          <label className="w-16 sm:w-20 text-[17px] font-bold text-slate-800">Account</label>
          <div className="w-full max-w-md">
            <ComboboxField
              inline
              value={form.cash_bank_ledger_id}
              onChange={(value) => setForm((prev) => ({ ...prev, cash_bank_ledger_id: value }))}
              options={cashBankLedgers}
              placeholder="Select Cash/Bank Account…"
              createHref="/dashboard/create/ledger"
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Particulars Section */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Header — desktop: two cols, mobile: single */}
          <div className="sticky top-0 z-10 border-b border-slate-200 px-6 py-2.5 text-[15px] font-extrabold uppercase tracking-wider text-slate-800 bg-slate-50/50 backdrop-blur-sm">
            <div className="md:hidden">Particulars</div>
            <div className="hidden md:grid md:grid-cols-[1fr_200px] gap-4">
              <div>Particulars</div>
              <div className="text-right">Amount</div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">

            {/* ── Mobile: stacked with labels ── */}
            <div className="md:hidden flex flex-col gap-4 p-4 hover:bg-amber-50/30 transition-colors">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Party</label>
                <ComboboxField
                  inline
                  value={form.party_ledger_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, party_ledger_id: value }))}
                  options={partyLedgers}
                  placeholder="Select Party…"
                  createHref="/dashboard/create/ledger"
                  disabled={readOnly}
                />
                {selectedPartyLedger && (
                  <div className="text-[13px] font-medium text-slate-500 italic flex gap-1.5 ml-1">
                    <span>Cur Bal:</span>
                    <span>0.00 Cr</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Amount</label>
                <input
                  className="h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-[16px] font-bold text-slate-900 text-left shadow-sm outline-none transition hover:border-tally-400 focus:border-tally-500 focus:ring-2 focus:ring-tally-500/[0.15] disabled:opacity-60 disabled:bg-slate-50"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  placeholder="0.00"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* ── Desktop: original side-by-side grid ── */}
            <div className="hidden md:grid md:grid-cols-[1fr_200px] gap-4 px-6 py-3 items-start hover:bg-amber-50/30 transition-colors">
              <div>
                <ComboboxField
                  inline
                  value={form.party_ledger_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, party_ledger_id: value }))}
                  options={partyLedgers}
                  placeholder="Select Party…"
                  createHref="/dashboard/create/ledger"
                  disabled={readOnly}
                />
                {selectedPartyLedger && (
                  <div className="mt-1.5 text-[15px] font-medium text-slate-600 italic flex gap-2 ml-1">
                    <span>Cur Bal:</span>
                    <span>0.00 Cr</span>
                  </div>
                )}
              </div>
              <div>
                <input
                  className="h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-[16px] font-bold text-slate-900 text-right shadow-sm outline-none transition hover:border-tally-400 focus:border-tally-500 focus:ring-2 focus:ring-tally-500/[0.15] disabled:opacity-60 disabled:bg-slate-50"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  placeholder="0.00"
                  disabled={readOnly}
                />
              </div>
            </div>


            {/* Bill-wise Details Button + Summary */}
            {partyHasBillByBill && form.party_ledger_id && form.amount > 0 && (
              <div className="px-4 md:px-6 pb-3">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 hover:border-sky-300 disabled:opacity-50"
                  onClick={onOpenBillWise}
                  disabled={readOnly}
                  data-entry-action="true"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                  {form.bill_allocations.length > 0
                    ? `Bill-wise Details (${form.bill_allocations.length} allocation${form.bill_allocations.length > 1 ? "s" : ""})`
                    : "Add Bill-wise Details"
                  }
                </button>

                {/* Allocation summary chips */}
                {form.bill_allocations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.bill_allocations.map((alloc, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${alloc.ref_type === "Agst Ref" ? "bg-emerald-500" : alloc.ref_type === "New Ref" ? "bg-sky-500" : alloc.ref_type === "Advance" ? "bg-amber-500" : "bg-slate-400"}`} />
                        {alloc.ref_type}: {alloc.ref_name}
                        <span className="font-semibold ml-0.5">₹{alloc.amount.toLocaleString("en-IN")}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (meta.family !== "journal") {
    return (
      <div className="shrink-0 border-b border-slate-500 bg-slate-50/50 p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:gap-4 max-w-7xl">
          {/* Card 1: Bill To / Party / Primary Ledger */}
          {(meta.family === "invoice" || meta.family === "contra") && (
            <div className={`rounded-xl border border-slate-300 bg-white p-4 shadow-sm transition-all hover:shadow-md ${meta.family === "contra" ? "" : "border-l-[4px] border-l-emerald-500"}`}>
              <h3 className="mb-3 flex items-center gap-2.5 text-[17px] font-extrabold uppercase tracking-wider text-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  {meta.family === "contra" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                </div>
                {meta.family === "contra" ? "Transfer Details" : "Bill To"}
              </h3>

              <div className="space-y-2.5">
                {meta.family === "contra" ? (
                  <div className="relative flex flex-col gap-5 py-2">
                    {/* Visual connecting line */}
                    <div className="absolute left-[1.15rem] top-6 bottom-6 w-0.5 bg-slate-200" />

                    {/* Source Account */}
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-100 shadow-sm z-10">
                        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[13px] font-bold uppercase tracking-wide text-rose-600">Transfer From</label>
                          <span className="text-[12px] text-slate-500 font-medium tracking-normal">(Payment / Credit)</span>
                        </div>
                        <ComboboxField inline={true} chevron={true} value={form.source_ledger_id} onChange={(value) => setForm((prev) => ({ ...prev, source_ledger_id: value }))} options={cashBankLedgers} placeholder="Select Source Account…" createHref="/dashboard/create/ledger" disabled={readOnly} />
                      </div>
                    </div>

                    {/* Destination Account */}
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-100 shadow-sm z-10">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[13px] font-bold uppercase tracking-wide text-emerald-600">Transfer To</label>
                          <span className="text-[12px] text-slate-500 font-medium tracking-normal">(Receipt / Debit)</span>
                        </div>
                        <ComboboxField inline={true} chevron={true} value={form.destination_ledger_id} onChange={(value) => setForm((prev) => ({ ...prev, destination_ledger_id: value }))} options={cashBankLedgers} placeholder="Select Destination Account…" createHref="/dashboard/create/ledger" disabled={readOnly} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] font-bold text-slate-700">Party Name <span className="text-rose-500">*</span></label>
                      <ComboboxField
                        inline
                        compact={true}
                        chevron={true}
                        value={form.party_ledger_id}
                        onChange={(value) => {
                          setForm((prev) => ({ ...prev, party_ledger_id: value }));
                          if (value && (meta.category === "Debit Note" || meta.category === "Credit Note")) {
                             if (onPartySelected) {
                                onPartySelected();
                             }
                          }
                        }}
                        options={partyLedgers}
                        placeholder="Select Party…"
                        createHref="/dashboard/create/ledger"
                        disabled={readOnly}
                        mandatory={true}
                      />
                    </div>

                    {selectedPartyLedger?.party_details && (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-100/50 bg-emerald-50/30 p-3.5 text-[15px] font-medium text-slate-700">
                        {selectedPartyLedger.party_details.address && (
                          <div className="flex items-start gap-2.5">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <span className="leading-relaxed whitespace-pre-wrap">{selectedPartyLedger.party_details.address}</span>
                          </div>
                        )}
                        {selectedPartyLedger.party_details.gstin && (
                          <div className="flex items-center gap-2.5">
                            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="font-mono text-slate-700">{selectedPartyLedger.party_details.gstin}</span>
                          </div>
                        )}
                        {selectedPartyLedger.party_details.state && (
                          <div className="flex items-center gap-2.5">
                            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                            </svg>
                            <span className="text-slate-700">{selectedPartyLedger.party_details.state}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Card 2: Additional Details / Cash-Bank / Amount */}
          {(meta.family === "invoice" || meta.family === "contra") && (
            <div className={`rounded-xl border border-slate-300 bg-white p-4 shadow-sm transition-all hover:shadow-md ${meta.family === "contra" ? "" : "border-l-[4px] border-l-orange-500"}`}>
              <h3 className="mb-3 flex items-center gap-2.5 text-[17px] font-extrabold uppercase tracking-wider text-orange-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  {meta.family === "invoice" ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  )}
                </div>
                {meta.family === "invoice" ? "Voucher Details" : "Transaction Details"}
              </h3>
              <div className="space-y-2.5">
                {meta.family === "contra" ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700">Amount <span className="text-rose-500">*</span></label>
                    <input
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[15px] font-bold text-slate-900 shadow-sm outline-none transition focus:border-tally-500 focus:ring-2 focus:ring-tally-500/20 disabled:opacity-60 disabled:bg-slate-50"
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                  </div>
                ) : null}

                {meta.family === "invoice" ? (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Place of Supply (just a visual representation of State for now) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] font-bold text-slate-700">Place of Supply</label>
                      <div className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-800 shadow-sm">
                        {selectedPartyLedger?.party_details?.state || "—"}
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Tax Mode (derived) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] font-bold text-slate-700">Tax Mode</label>
                      <div className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-800 capitalize shadow-sm">
                        {taxMode === "intra" ? "Intra-State" : "Inter-State"}
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
