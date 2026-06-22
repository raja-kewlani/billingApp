"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: "Create",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    children: [
      { label: "Sales Invoice", href: "/dashboard/create/sales-invoice" },
      { label: "Purchase Invoice", href: "/dashboard/create/purchase-invoice" },
      { label: "Receipt", href: "/dashboard/create/receipt" },
      { label: "Payment", href: "/dashboard/create/payment" },
      { label: "Debit Note", href: "/dashboard/create/debit-note" },
      { label: "Credit Note", href: "/dashboard/create/credit-note" },
      { label: "Journal Entry", href: "/dashboard/create/journal-entry" },
      { label: "Contra Entry", href: "/dashboard/create/contra-entry" },
      { label: "Ledger", href: "/dashboard/create/ledger" },
    ],
  },
  {
    label: "Inventory",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5 12 3 3 7.5m18 0v9L12 21m9-13.5-9 4.5m0 9V12m0 0L3 7.5" />
      </svg>
    ),
    children: [
      { label: "Inventory Hub", href: "/dashboard/inventory" },
      { label: "Items", href: "/dashboard/inventory/items" },
      { label: "UOM", href: "/dashboard/inventory/uom" },
      { label: "Stock Summary", href: "/dashboard/inventory/stock-summary" },
    ],
  },
  {
    label: "Books",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    children: [
      { label: "Sales Register", href: "/dashboard/books/sales-register" },
      { label: "Purchase Register", href: "/dashboard/books/purchase-register" },
      { label: "Receipt Register", href: "/dashboard/books/receipt-register" },
      { label: "Payment Register", href: "/dashboard/books/payment-register" },
      { label: "Debit Note Reg.", href: "/dashboard/books/debit-note-register" },
      { label: "Credit Note Reg.", href: "/dashboard/books/credit-note-register" },
      { label: "Journal Register", href: "/dashboard/books/journal-register" },
      { label: "Contra Register", href: "/dashboard/books/contra-register" },
      { label: "Day Book", href: "/dashboard/books/day-book" },
      { label: "Cash Book", href: "/dashboard/books/cash-book" },
      { label: "Ledger", href: "/dashboard/books/ledger" },
    ],
  },
  {
    label: "Reconcile",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.59 48.59 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52v8.625c0 2.873-2.372 5.25-5.25 5.25m-8.25-13.87v8.625c0 2.873 2.372 5.25 5.25 5.25" />
      </svg>
    ),
    children: [
      { label: "GSTR-2A Recon", href: "/dashboard/reconciliation" },
    ],
  },
  {
    label: "Settings",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    children: [
      { label: "Configure a bill template", href: "/dashboard/settings/bill-template" },
      { label: "Configure Voucher Details", href: "/dashboard/settings/voucher-details" },
      { label: "Firm Details", href: "/dashboard/settings/firm-details" },
      { label: "Firm Invites", href: "/dashboard/settings/invites" },
      { label: "Paused Access", href: "/dashboard/settings/paused-access" },
      { label: "Period Block", href: "/dashboard/settings/period-block" },
      { label: "Provide Feedback", href: "/dashboard/feedback" },
      { label: "Client Issues", href: "/dashboard/settings/client-issues" },
    ],
  },
];

import { useDashboardChrome } from "@/context/DashboardChromeContext";

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useDashboardChrome();
  const { isCAAdmin, isCAEmployee } = useProfile();

  const filteredNavItems = NAV_ITEMS.map((item) => {
    if (item.label === "Settings" && item.children) {
      return {
        ...item,
        children: item.children.filter((child) => {
          if (child.label === "Firm Invites" || child.label === "Paused Access" || child.label === "Client Issues") {
            return isCAAdmin || isCAEmployee;
          }
          if (child.label === "Provide Feedback") {
            return !isCAAdmin && !isCAEmployee;
          }
          return true;
        }),
      };
    }
    return item;
  });

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const handleItemClick = (label?: string) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      if (label) {
        setExpandedSections((prev) => ({ ...prev, [label]: true }));
      }
    } else if (label) {
      toggleSection(label);
    }
  };

  const isActive = (href?: string) => Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));

  return (
    <aside className={`fixed z-40 hidden bg-[#163324] text-white lg:flex transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarCollapsed ? 'top-5 bottom-5 left-5 w-[80px] rounded-[28px] border border-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]' : 'top-0 bottom-0 left-0 w-[320px] rounded-none border-r border-white/[0.03] shadow-[10px_0_40px_rgba(0,0,0,0.2)]'}`} style={{ zoom: "var(--scale-sidebar-relative)" } as React.CSSProperties}>
      {/* Collapse Toggle Button */}
      <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-50 group/toggle">
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0d2117] border border-white/[0.05] text-white/50 hover:text-white hover:bg-[#122b1e] shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all backdrop-blur-md"
        >
          <svg className={`h-3 w-3 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        {/* Tooltip for Toggle Button */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2 rounded bg-[#0a1a12] border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/toggle:opacity-100 pointer-events-none whitespace-nowrap shadow-xl">
          {isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        </div>
      </div>

      <div className={`flex h-full w-full flex-col py-6 transition-all duration-300 ${isSidebarCollapsed ? 'px-3' : 'px-5'}`}>
        {/* Workspace Profile Dropdown Switcher */}
        <Link href="/dashboard" className={`group rounded-2xl transition-all duration-300 active:scale-[0.98] ${isSidebarCollapsed ? 'p-2 flex justify-center hover:bg-black/20' : 'p-3.5 bg-black/20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] hover:bg-black/30'}`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-tally-300 to-tally-500 font-bold text-tally-950 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.6)]">
                B
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0 animate-in fade-in duration-300">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/50">Workspace</p>
                  <span className="mt-0.5 block truncate text-[18px] font-bold tracking-tight text-white group-hover:text-emerald-50">BillingApp</span>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <svg className="h-5 w-5 shrink-0 text-white/30 transition-transform duration-200 group-hover:text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </div>
        </Link>

        {/* Command Search Bar */}
        <button
          onClick={() => {}}
          className={`mt-5 flex items-center rounded-xl transition-all hover:bg-black/10 hover:shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)] hover:text-white ${isSidebarCollapsed ? 'p-3 justify-center' : 'px-3.5 py-3 justify-between'} text-[17px] font-medium text-white/50`}
        >
          <span className="flex items-center gap-2.5">
            <svg className="h-5 w-5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
            {!isSidebarCollapsed && "Search or Command..."}
          </span>
          {!isSidebarCollapsed && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/50 tracking-widest shrink-0">⌘K</span>}
        </button>

        <div className={`mt-6 transition-all duration-300 ${isSidebarCollapsed ? 'px-0 text-center' : 'px-3'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.26em] text-white/35 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Navigation</p>
          {isSidebarCollapsed && <div className="h-px w-6 mx-auto bg-white/10" />}
        </div>

        <nav className={`mt-3 flex-1 overflow-y-auto pb-5 custom-scrollbar overflow-x-hidden transition-all duration-300 ${isSidebarCollapsed ? 'px-0 flex flex-col justify-center space-y-6' : 'px-1 space-y-1'}`}>
          {filteredNavItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const childIsActive = item.children?.some((child) => pathname.startsWith(child.href)) ?? false;
            const isOpen = expandedSections[item.label] ?? childIsActive;
            const active = isActive(item.href);

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-0.5">
                  <button
                    onClick={() => handleItemClick(item.label)}
                    className={`group relative flex w-full items-center justify-between transition-all duration-300 ${isSidebarCollapsed ? 'p-3.5 justify-center rounded-2xl' : 'px-3.5 py-3 rounded-xl'} text-[18px] font-bold ${isOpen || childIsActive
                        ? "text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`shrink-0 transition-all duration-300 ${childIsActive ? "text-tally-300" : "text-white/75 group-hover:text-white"} ${isSidebarCollapsed ? '[&>svg]:w-[26px] [&>svg]:h-[26px] [&>svg]:stroke-[2px]' : ''}`}>
                        {item.icon}
                      </span>
                      {!isSidebarCollapsed && item.label}
                    </span>
                    {!isSidebarCollapsed && (
                      <svg className={`h-5 w-5 shrink-0 text-white/30 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? "rotate-180 text-white/70" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {isSidebarCollapsed && (
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 rounded bg-[#0a1a12] border border-white/10 px-2 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                        {item.label}
                      </div>
                    )}
                  </button>

                  {!isSidebarCollapsed && (
                    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                      <div className="overflow-hidden">
                        <div className="ml-[22px] border-l border-white/[0.06] pl-4 space-y-1 pb-2 pt-2 mt-1">
                          {item.children!.map((child) => {
                            const subActive = pathname.startsWith(child.href);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={`group relative flex items-center rounded-lg px-3 py-2.5 text-[16px] font-medium leading-5 transition-all duration-300 ${subActive
                                    ? "bg-black/25 font-semibold text-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
                                    : "text-white/50 hover:bg-white/5 hover:text-white"
                                  }`}
                              >
                                {subActive && (
                                  <div className="absolute left-[-16.5px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-tally-300 shadow-[0_0_6px_rgba(194,240,213,0.6)]" />
                                )}
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href!}
                onClick={() => { if (isSidebarCollapsed) setIsSidebarCollapsed(false); }}
                className={`group relative flex items-center gap-3 transition-all duration-300 overflow-hidden ${isSidebarCollapsed ? 'p-3.5 justify-center rounded-2xl' : 'px-3.5 py-3 rounded-xl'} text-[18px] font-bold ${active
                    ? "bg-black/25 text-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]"
                    : "text-white/60 hover:bg-white/5 hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                  }`}
              >
                {active && !isSidebarCollapsed && (
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-tally-400 to-tally-600 shadow-[0_0_12px_rgba(194,240,213,0.8)]`} />
                )}
                {active && isSidebarCollapsed && (
                  <div className={`absolute inset-0 bg-gradient-to-br from-tally-400/10 to-transparent pointer-events-none`} />
                )}
                <span className={`shrink-0 transition-all duration-300 ${active ? "text-tally-300" : "text-white/75 group-hover:text-white"} ${isSidebarCollapsed ? '[&>svg]:w-[26px] [&>svg]:h-[26px] [&>svg]:stroke-[2px]' : ''}`}>
                  {item.icon}
                </span>
                {!isSidebarCollapsed && item.label}

                {/* Tooltip for collapsed state */}
                {isSidebarCollapsed && (
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 rounded bg-[#0a1a12] border border-white/10 px-2 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Streamlined Footer Firm Switcher */}
        <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
          <Link href="/firms" className={`group relative flex items-center transition-all duration-300 text-[18px] font-bold text-white/50 hover:bg-white/5 hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${isSidebarCollapsed ? 'p-3.5 justify-center rounded-2xl' : 'px-4 py-3 justify-between rounded-xl'}`}>
            <span className="flex items-center gap-3">
              <svg className={`shrink-0 text-white/60 group-hover:text-tally-300 transition-all duration-300 ${isSidebarCollapsed ? 'w-[28px] h-[28px] stroke-[2px]' : 'w-7 h-7 stroke-[2px]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              {!isSidebarCollapsed && "Switch Firm"}
            </span>
            
            {/* Tooltip for collapsed state */}
            {isSidebarCollapsed && (
              <div className="absolute left-14 top-1/2 -translate-y-1/2 rounded bg-[#0a1a12] border border-white/10 px-2 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                Switch Firm
              </div>
            )}
          </Link>
        </div>
      </div>
    </aside>
  );
}
