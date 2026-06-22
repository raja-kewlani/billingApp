"use client";

import { useProfile } from "@/context/ProfileContext";
import { useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "../../components/SignOutButton";
import BottomSheet from "../../components/BottomSheet";
import Link from "next/link";
import { apiRequest } from "@/lib/http";

import { useDateFilter } from "@/context/DateFilterContext";
import { useFirmScope } from "../shared/useFirmScope";
import { useGlobalSearch } from "@/context/GlobalSearchContext";
import { DateRangePicker } from "./DateRangePicker";

export default function Header() {
  const { fromDate, toDate, setDateRange } = useDateFilter();
  const { profile, isCA, activeFirmId, supabase } = useFirmScope();
  const { globalSearchQuery, setGlobalSearchQuery } = useGlobalSearch();
  
  const [firmName, setFirmName] = useState("");
  const [firmDetails, setFirmDetails] = useState<{ gstin?: string; state?: string }>({});
  
  const pathname = usePathname();
  const isDashboardHome = pathname === "/dashboard";

  const [isWorkspaceSheetOpen, setIsWorkspaceSheetOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [firmsCount, setFirmsCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchFirmName() {
      if (!activeFirmId) return;

      const { data } = await supabase
        .from("firms")
        .select("name, gstin, state")
        .eq("id", activeFirmId)
        .single();

      if (data) {
        setFirmName(data.name);
        setFirmDetails({ gstin: data.gstin, state: data.state });
      }
    }

    async function fetchFirmsCount() {
      if (!profile) return;
      try {
        const data = await apiRequest<any[]>(supabase, "/api/firms/my-firms");
        setFirmsCount(data ? data.length : 0);
      } catch (err) {
        console.error(err);
      }
    }

    void fetchFirmName();
    void fetchFirmsCount();
  }, [activeFirmId, profile, supabase]);

  const isInventorySubpage = pathname.startsWith("/dashboard/inventory/");
  const isBooksSubpage = pathname.startsWith("/dashboard/books/");
  const hideHeaderOnMobile = isInventorySubpage || isBooksSubpage;

  return (
    <header className={`sticky top-0 z-30 border-b border-white/60 bg-[rgba(248,245,239,0.84)] backdrop-blur-xl ${hideHeaderOnMobile ? 'hidden lg:block' : ''}`}>
      <div className="mx-auto flex w-full max-w-[var(--content-max-w)] flex-col gap-4 px-4 pt-4 pb-1.5 sm:px-6 lg:px-8 sm:py-4 transition-[max-width] duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
        <div className="flex w-full flex-wrap items-start justify-between gap-4 lg:flex-nowrap lg:items-center">
          <button 
            onClick={() => setIsWorkspaceSheetOpen(true)}
            className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3 text-left transition-opacity hover:opacity-80 active:opacity-70 lg:cursor-default lg:pointer-events-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Active Workspace
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-2xl lg:text-[28px]">
                  {firmName || "Loading..."}
                </h1>
                <svg className="h-5 w-5 shrink-0 text-slate-400 lg:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium text-slate-500">
                {firmDetails.state && <span>{firmDetails.state}</span>}
                {firmDetails.gstin && (
                  <>
                    {firmDetails.state && <span className="text-slate-300">•</span>}
                    <span className="break-all">GSTIN: {firmDetails.gstin}</span>
                  </>
                )}
              </div>
            </div>
          </button>

          {!isDashboardHome && (
            <div className="hidden flex-1 px-6 lg:flex lg:max-w-2xl">
              <div className="relative w-full">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search vouchers, ledgers, reports..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="h-[52px] w-full rounded-2xl border border-slate-200/60 bg-white/90 pl-12 pr-20 text-[15px] font-medium text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300 hover:bg-white"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] text-slate-400 shadow-sm">
                    CMD K
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div className="hidden xl:block">
              <DateRangePicker 
                fromDate={fromDate}
                toDate={toDate}
                onChangeFrom={(val) => setDateRange(val, toDate)}
                onChangeTo={(val) => setDateRange(fromDate, val)}
              />
            </div>

            <button className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px] bg-white text-slate-600 shadow-sm transition hover:bg-slate-50">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="absolute right-[14px] top-[14px] h-[11px] w-[11px] rounded-full border-[2.5px] border-white bg-red-400" />
            </button>

            <button 
              onClick={() => setIsProfileSheetOpen(true)}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px] bg-[#3A604D] text-xl font-medium text-white shadow-sm transition-transform active:scale-95"
            >
              {profile?.full_name?.charAt(0)?.toUpperCase() || "M"}
            </button>

            <div className="hidden xl:block ml-2">
              <SignOutButton />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:hidden">
          {!isDashboardHome && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search vouchers, ledgers, reports..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                className="h-[52px] w-full rounded-2xl border border-slate-200/60 bg-white/90 pl-12 pr-4 text-[15px] font-medium text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300 hover:bg-white"
              />
            </div>
          )}
          
          <DateRangePicker 
            fromDate={fromDate}
            toDate={toDate}
            onChangeFrom={(val) => setDateRange(val, toDate)}
            onChangeTo={(val) => setDateRange(fromDate, val)}
          />
        </div>
      </div>

      {/* Mobile Workspace Switcher */}
      <BottomSheet 
        isOpen={isWorkspaceSheetOpen} 
        onClose={() => setIsWorkspaceSheetOpen(false)}
      >
        <div className="flex flex-col gap-6 pt-2 pb-4">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-tally-400 font-bold text-tally-900 shadow-xl shadow-emerald-950/10 text-2xl">
              B
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mt-3">{firmName || "Loading..."}</h2>
            <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
              {firmDetails.state && <span>{firmDetails.state}</span>}
              {firmDetails.gstin && (
                <>
                  {firmDetails.state && <span className="text-slate-300">•</span>}
                  <span>GSTIN: {firmDetails.gstin}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="h-px w-full bg-slate-100" />
          
          <div className="flex flex-col gap-3">
            {firmsCount !== null && firmsCount <= 1 ? (
              <Link 
                href="/onboarding/start"
                onClick={() => setIsWorkspaceSheetOpen(false)}
                className="group flex items-center justify-between rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] shadow-sm shadow-emerald-950/20"
              >
                <span className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-emerald-200 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Firm
                </span>
                <svg className="h-4 w-4 text-emerald-200 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ) : (
              <Link 
                href="/firms"
                onClick={() => setIsWorkspaceSheetOpen(false)}
                className="group flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-900 active:scale-[0.98]"
              >
                <span className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-white/70 group-hover:text-tally-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Switch Workspace
                </span>
                <svg className="h-4 w-4 text-white/50 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Mobile Profile & Settings */}
      <BottomSheet 
        isOpen={isProfileSheetOpen} 
        onClose={() => setIsProfileSheetOpen(false)}
      >
        <div className="flex flex-col gap-6 pt-2 pb-4">
          <div className="flex items-center gap-4 rounded-3xl bg-slate-50/80 p-4 border border-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tally-700 text-lg font-bold text-white shadow-md">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {profile?.full_name || "User"}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">
                {isCA ? "CA workspace" : "Merchant workspace"}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Link 
              href="/dashboard/settings/firm-details"
              onClick={() => setIsProfileSheetOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              Settings & Firm Details
            </Link>
            
            {!isCA && (
              <Link 
                href="/dashboard/feedback"
                onClick={() => setIsProfileSheetOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                  </svg>
                </div>
                Provide Feedback
              </Link>
            )}

            {isCA && (
              <Link 
                href="/dashboard/settings/client-issues"
                onClick={() => setIsProfileSheetOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                Client Issues
              </Link>
            )}
            
            <Link 
              href="/dashboard/settings/bill-template"
              onClick={() => setIsProfileSheetOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              Configure Bill Template
            </Link>

            <Link 
              href="/dashboard/settings/voucher-details"
              onClick={() => setIsProfileSheetOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
                </svg>
              </div>
              Configure Voucher Details
            </Link>

            <Link 
              href="/dashboard/reconciliation"
              onClick={() => setIsProfileSheetOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.59 48.59 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52v8.625c0 2.873-2.372 5.25-5.25 5.25m-8.25-13.87v8.625c0 2.873 2.372 5.25 5.25 5.25" />
                </svg>
              </div>
              GSTR-2A Reconciliation
            </Link>
            
            <div className="my-2 h-px w-full bg-slate-100" />
            
            <div className="px-2 w-full flex items-center justify-center">
              <SignOutButton />
            </div>
          </div>
        </div>
      </BottomSheet>
    </header>
  );
}
