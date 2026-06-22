"use client";

import { useState, useEffect } from "react";
import { useFirmScope } from "@/app/dashboard/shared/useFirmScope";

export default function VoucherDetailsPage() {
  const { activeFirmId, supabase } = useFirmScope();
  const [permanentDiscount, setPermanentDiscount] = useState<boolean>(false);
  const [rateInclusiveTax, setRateInclusiveTax] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchFirmSettings() {
      if (!activeFirmId) return;
      try {
        const { data, error } = await supabase
          .from("firms")
          .select("permanent_discount_toggle, rate_inclusive_tax_toggle")
          .eq("id", activeFirmId)
          .single();

        if (error) throw error;
        if (data) {
          setPermanentDiscount(data.permanent_discount_toggle || false);
          setRateInclusiveTax(data.rate_inclusive_tax_toggle || false);
        }
      } catch (err) {
        console.error("Error fetching firm settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFirmSettings();
  }, [activeFirmId, supabase]);

  const handleToggle = async () => {
    if (!activeFirmId || isSaving) return;
    const newValue = !permanentDiscount;
    setPermanentDiscount(newValue);
    setIsSaving(true);
    setMessage(null);
    
    try {
      const { data, error } = await supabase
        .from("firms")
        .update({ permanent_discount_toggle: newValue })
        .eq("id", activeFirmId)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No firm was updated. You may not have permission.");
      }
      setMessage({ text: `Permanent discount ${newValue ? "enabled" : "disabled"}`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error updating firm settings:", err);
      setMessage({ text: "Failed to update setting", type: 'error' });
      // Revert on failure
      setPermanentDiscount(!newValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateInclusiveToggle = async () => {
    if (!activeFirmId || isSaving) return;
    const newValue = !rateInclusiveTax;
    setRateInclusiveTax(newValue);
    setIsSaving(true);
    setMessage(null);
    
    try {
      const { data, error } = await supabase
        .from("firms")
        .update({ rate_inclusive_tax_toggle: newValue })
        .eq("id", activeFirmId)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No firm was updated. You may not have permission.");
      }
      setMessage({ text: `Rate Inclusive of Tax ${newValue ? "enabled" : "disabled"}`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error updating firm settings:", err);
      setMessage({ text: "Failed to update setting", type: 'error' });
      // Revert on failure
      setRateInclusiveTax(!newValue);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Configure Voucher Details</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage how your vouchers look and function.
        </p>
      </div>

      <div className="max-w-2xl">
        {message && (
          <div className={`mb-4 rounded-xl p-4 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {isLoading ? (
            <div className="flex items-center space-x-4 animate-pulse">
              <div className="h-6 w-3/4 rounded bg-slate-200"></div>
              <div className="h-6 w-12 rounded-full bg-slate-200"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-slate-800">Permanent Discount Toggle</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    If enabled, the permanent discount field will be available on all your vouchers. If disabled, it will be hidden.
                  </p>
                </div>
                
                <button
                  type="button"
                  role="switch"
                  aria-checked={permanentDiscount}
                  onClick={handleToggle}
                  disabled={isSaving}
                  className={`${
                    permanentDiscount ? 'bg-tally-500' : 'bg-slate-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tally-500 focus:ring-offset-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Toggle Permanent Discount</span>
                  <span
                    aria-hidden="true"
                    className={`${
                      permanentDiscount ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
              
              <hr className="my-6 border-slate-100" />
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-slate-800">Rate Inclusive of Tax Toggle</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    If enabled, you can enter the final total rate (including tax) for items, and the system will reverse-calculate the taxable amount.
                  </p>
                </div>
                
                <button
                  type="button"
                  role="switch"
                  aria-checked={rateInclusiveTax}
                  onClick={handleRateInclusiveToggle}
                  disabled={isSaving}
                  className={`${
                    rateInclusiveTax ? 'bg-tally-500' : 'bg-slate-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tally-500 focus:ring-offset-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Toggle Rate Inclusive of Tax</span>
                  <span
                    aria-hidden="true"
                    className={`${
                      rateInclusiveTax ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
