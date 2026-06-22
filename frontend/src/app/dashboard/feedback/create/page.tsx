"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFirmScope } from "@/app/dashboard/shared/useFirmScope";
import { apiRequest } from "@/lib/http";
import Link from "next/link";

export default function CreateFeedbackPage() {
  const router = useRouter();
  const { activeFirmId, supabase, isCA } = useFirmScope();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If CA, block access
  if (isCA) {
    if (typeof window !== "undefined") {
      router.replace("/dashboard");
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !activeFirmId) return;

    try {
      setIsSubmitting(true);
      setError("");
      await apiRequest(supabase, "/api/feedback", {
        method: "POST",
        body: {
          description: description.trim(),
          firm_id: activeFirmId,
        },
      });
      router.push("/dashboard/feedback");
    } catch (err: any) {
      console.error("Failed to post feedback", err);
      setError(err.message || "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pt-4 sm:pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Provide Feedback</h1>
        <p className="mt-2 text-sm text-slate-500">Report an issue or provide feedback directly to your CA.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
              Problem Description
            </label>
            <textarea
              id="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-900 placeholder-slate-400 focus:border-tally-500 focus:bg-white focus:ring-4 focus:ring-tally-500/10 outline-none transition"
              placeholder="Describe the issue you are facing..."
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/dashboard/feedback"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="rounded-xl bg-tally-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-tally-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tally-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "Posting..." : "Post Problem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
