"use client";

import { useState, useEffect } from "react";
import { useFirmScope } from "@/app/dashboard/shared/useFirmScope";
import { apiRequest } from "@/lib/http";
import { useRouter } from "next/navigation";

interface Feedback {
  id: string;
  firm_id: string;
  created_by: string;
  description: string;
  is_solved: boolean;
  created_at: string;
}

export default function ClientIssuesPage() {
  const { activeFirmId, supabase, isCA } = useFirmScope();
  const router = useRouter();
  const [issues, setIssues] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isCA) {
      if (typeof window !== "undefined") {
        router.replace("/dashboard");
      }
      return;
    }

    async function fetchIssues() {
      if (!activeFirmId) return;
      try {
        setIsLoading(true);
        const data = await apiRequest<Feedback[]>(supabase, `/api/feedback?firm_id=${activeFirmId}`);
        // Only show unresolved issues to CA
        setIssues((data || []).filter(issue => !issue.is_solved));
      } catch (err) {
        console.error("Error fetching issues:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    void fetchIssues();
  }, [activeFirmId, supabase, isCA, router]);

  const handleSolve = async (id: string) => {
    try {
      await apiRequest(supabase, `/api/feedback/${id}/solve`, { method: "PATCH" });
      setIssues((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Failed to mark as solved", err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIssues(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-tally-700"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pt-4 sm:pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Client Issues</h1>
        <p className="mt-2 text-sm text-slate-500">Review and resolve problems reported by your clients for this firm.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {issues.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No active issues for this firm.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((item, index) => {
              const isExpanded = expandedIssues[item.id];
              return (
                <li key={item.id} className="transition hover:bg-slate-50/50">
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <button 
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-3 w-full text-left"
                      >
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                          Problem {index + 1}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        <svg className={`ml-auto h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap pl-1 border-l-2 border-red-200">
                          {item.description}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                      <button
                        onClick={() => handleSolve(item.id)}
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 transition"
                      >
                        Issue Solved
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
