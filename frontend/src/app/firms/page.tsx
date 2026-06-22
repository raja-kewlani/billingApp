"use client";

import { useProfile } from "@/context/ProfileContext";
import SignOutButton from "../components/SignOutButton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Firm } from "@/interfaces/firm";
import { apiRequest } from "@/lib/http";

export default function FirmsPage() {
  const { profile, isLoading: isProfileLoading, supabase } = useProfile();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFirmsLoading, setIsFirmsLoading] = useState(true);

  useEffect(() => {
    async function getFirms() {
      if (!profile) return;

      try {
        setIsFirmsLoading(true);
        const data = await apiRequest<Firm[]>(supabase, "/api/firms/my-firms");
        setFirms(data || []);
      } catch (err) {
        console.error("Error fetching firms:", err);
      } finally {
        setIsFirmsLoading(false);
      }
    }

    if (profile) {
      void getFirms();
    }
  }, [profile, supabase]);

  const filteredFirms = firms.filter(
    (firm) =>
      firm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (firm.gstin && firm.gstin.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (isProfileLoading || (isFirmsLoading && firms.length === 0)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-tally-700" />
          <p className="animate-pulse text-sm text-slate-500">Loading firms...</p>
        </div>
      </main>
    );
  }

  // Removed CA-only render block
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(18,58,41,0.96),rgba(33,92,70,0.92))] px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:px-8 sm:py-9">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(216,243,220,0.28),transparent_58%)]" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Firm selection</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Choose the workspace you want to open next.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                Search across firms and jump into the right accounting environment without losing the cleaner dashboard styling.
              </p>
            </div>
            <div className="self-start flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/onboarding/start"
                className="inline-flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30 border border-white/20 shadow-sm"
              >
                Add Firm
              </Link>
              <SignOutButton />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_48px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Welcome</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {profile?.full_name ? `Hello, ${profile.full_name.split(" ")[0]}` : "Choose a firm"}
              </h2>
            </div>
            <div className="relative w-full max-w-xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by firm name or GSTIN"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/85 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredFirms.length > 0 ? (
              filteredFirms.map((firm) => (
                <div
                  key={firm.id}
                  className="flex flex-col gap-5 rounded-[28px] border border-slate-100 bg-white/92 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-950">{firm.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span>GSTIN: {firm.gstin || "Not provided"}</span>
                      {firm.state && <span>{firm.state}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {firm.has_unresolved_feedback && profile?.role !== 'merchant' && (
                      <div 
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm" 
                        title="Unresolved client issues"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                          <line x1="12" y1="9" x2="12" y2="13"></line>
                          <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                      </div>
                    )}
                    <Link
                      href={`/dashboard?firm_id=${firm.id}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                    >
                      Open workspace
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-12 text-center text-slate-500">
                No firms found matching your search.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
