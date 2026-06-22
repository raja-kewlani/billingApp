"use client";

import { useState, useEffect } from "react";
import { useFirmScope } from "@/app/dashboard/shared/useFirmScope";
import { apiRequest } from "@/lib/http";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Feedback {
  id: string;
  firm_id: string;
  created_by: string;
  description: string;
  is_solved: boolean;
  created_at: string;
}

export default function FeedbackPage() {
  const { activeFirmId, supabase, isCA } = useFirmScope();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issueToDelete, setIssueToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isCA) {
      if (typeof window !== "undefined") {
        router.replace("/dashboard");
      }
      return;
    }

    async function fetchFeedback() {
      if (!activeFirmId) return;
      try {
        setIsLoading(true);
        const data = await apiRequest<Feedback[]>(supabase, `/api/feedback?firm_id=${activeFirmId}`);
        setFeedbacks(data || []);
      } catch (err) {
        console.error("Error fetching feedback:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    void fetchFeedback();
  }, [activeFirmId, supabase, isCA, router]);

  const confirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await apiRequest(supabase, `/api/feedback/${id}`, { method: "DELETE" });
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      setIssueToDelete(null);
    } catch (err) {
      console.error("Failed to delete feedback", err);
    } finally {
      setIsDeleting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Posted Problems</h1>
          <p className="mt-2 text-sm text-slate-500">View and manage the issues you have reported to your CA.</p>
        </div>
        <Link
          href="/dashboard/feedback/create"
          className="inline-flex items-center justify-center rounded-xl bg-tally-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tally-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tally-600 active:scale-95"
        >
          <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Provide Feedback
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {feedbacks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            You haven't posted any problems yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {feedbacks.map((item, index) => {
              const isDeleteMode = issueToDelete === item.id;

              return (
                <li key={item.id} className="p-5 sm:p-6 transition hover:bg-slate-50/50 relative overflow-hidden">
                  <div className={`transition-all duration-300 ${isDeleteMode ? "opacity-30 blur-[2px]" : "opacity-100"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                            Problem {index + 1}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(item.created_at).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.description}</p>
                      </div>
                      <div className="flex items-center justify-end shrink-0">
                        <button
                          onClick={() => setIssueToDelete(item.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete Problem"
                          disabled={isDeleteMode}
                        >
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Delete Confirmation Overlay */}
                  {isDeleteMode && (
                    <div className="absolute inset-0 z-10 flex flex-col sm:flex-row items-center justify-center bg-white/60 backdrop-blur-[2px] p-4 gap-4 animate-in fade-in duration-200">
                      <p className="text-sm font-semibold text-slate-800 text-center sm:text-left">
                        Are you sure you want to delete this issue?
                      </p>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                          onClick={() => setIssueToDelete(null)}
                          disabled={isDeleting}
                          className="flex-1 sm:flex-none rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmDelete(item.id)}
                          disabled={isDeleting}
                          className="flex-1 sm:flex-none rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition"
                        >
                          {isDeleting ? "Deleting..." : "Delete Issue"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
