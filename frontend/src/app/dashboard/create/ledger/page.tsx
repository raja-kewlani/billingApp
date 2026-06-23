"use client";

import Link from "next/link";
import { useLedgerForm } from "./hooks/useLedgerForm";
import { PageHero } from "../../shared/WorkspaceUi";
import { LedgerCoreSection } from "./components/LedgerCoreSection";
import { LedgerPartySection } from "./components/LedgerPartySection";
import { LedgerBankSection } from "./components/LedgerBankSection";
import { LedgerTaxSection } from "./components/LedgerTaxSection";
import { useDashboardChrome } from "@/context/DashboardChromeContext";

export default function LedgerCreatePage() {
  const { isSidebarCollapsed } = useDashboardChrome();
  const {
    form,
    setForm,
    bankMeta,
    setBankMeta,
    bankErrors,
    setBankErrors,
    isSubmitting,
    isFetchingGst,
    isLoading,
    groups,
    templateType,
    ledgerId,
    handleFetchGstDetails,
    submit,
    returnTo,
  } = useLedgerForm();

  const cancelHref = returnTo || "/dashboard";

  if (ledgerId && isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(18,58,41,0.96),rgba(33,92,70,0.92))] px-6 py-7 shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:px-8 sm:py-9">
          <div className="h-4 w-28 animate-shimmer-fast rounded-full bg-white/15" />
          <div className="mt-4 h-10 w-72 animate-shimmer-fast rounded-full bg-white/15" />
          <div className="mt-3 h-5 w-[32rem] max-w-full animate-shimmer-fast rounded-full bg-white/10" />
        </div>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="h-6 w-32 animate-shimmer-fast rounded-full bg-slate-200" />
                <div className="h-4 w-72 animate-shimmer-fast rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="space-y-5">
              <div className="h-12 w-full animate-shimmer-fast rounded-2xl bg-slate-100" />
              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-12 w-full animate-shimmer-fast rounded-2xl bg-slate-100" />
                <div className="h-12 w-full animate-shimmer-fast rounded-2xl bg-slate-100" />
              </div>
              <div className="h-12 w-full animate-shimmer-fast rounded-2xl bg-slate-100" />
              <div className="h-28 w-full animate-shimmer-fast rounded-2xl bg-slate-100" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHero
        eyebrow="Ledger setup"
        title={ledgerId ? "Edit Ledger" : "Create Ledger"}
        description="Create or update the account master, then return to the dashboard when you're done."
      >
        <Link
          href={cancelHref}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>{returnTo ? "Back" : "Back to dashboard"}</span>
        </Link>
      </PageHero>

      <LedgerCoreSection
        form={form}
        setForm={setForm}
        groups={groups}
        isLoading={isLoading}
      />

      {(templateType === "party" || templateType === "bank") && (
        <LedgerPartySection
          form={form}
          setForm={setForm}
          isFetchingGst={isFetchingGst}
          onFetchGstDetails={() => void handleFetchGstDetails()}
          templateType={templateType}
        />
      )}

      {templateType === "bank" && (
        <LedgerBankSection
          form={form}
          setForm={setForm}
          bankMeta={bankMeta}
          setBankMeta={setBankMeta}
          bankErrors={bankErrors}
          setBankErrors={setBankErrors}
        />
      )}

      {templateType === "tax" && (
        <LedgerTaxSection form={form} setForm={setForm} />
      )}

      {/* Sticky footer */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 border-t border-slate-200 bg-white/80 p-4 sm:px-6 shadow-[0_-4px_24px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarCollapsed ? "lg:left-[var(--sidebar-space-collapsed)]" : "lg:left-[var(--sidebar-space-expanded)]"}`}>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-slate-900">Ready to save this ledger?</p>
        </div>
        <div className="flex w-full sm:w-auto gap-3">
          <Link
            href={cancelHref}
            className="flex flex-1 sm:flex-none items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            disabled={isSubmitting || isLoading}
            onClick={() => void submit()}
            className="flex flex-1 sm:flex-none items-center justify-center rounded-xl bg-[#0B1021] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : ledgerId ? "Update ledger" : "Create ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}
