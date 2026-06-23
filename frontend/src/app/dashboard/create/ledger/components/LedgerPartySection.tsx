"use client";

import { SurfaceCard } from "@/app/dashboard/shared/WorkspaceUi";
import { Field, Input, Select, LabeledToggle } from "./LedgerFormPrimitives";
import { LedgerFormState, SelectFieldChangeEvent, TextFieldChangeEvent } from "../types";

interface Props {
  form: LedgerFormState;
  setForm: React.Dispatch<React.SetStateAction<LedgerFormState>>;
  isFetchingGst: boolean;
  onFetchGstDetails: () => void;
  templateType: "party" | "bank" | "tax" | "core";
}

export function LedgerPartySection({ form, setForm, isFetchingGst, onFetchGstDetails, templateType }: Props) {
  const p = form.party_details;

  function updateParty(patch: Partial<LedgerFormState["party_details"]>) {
    setForm((prev) => ({ ...prev, party_details: { ...prev.party_details, ...patch } }));
  }

  return (
    <SurfaceCard
      title="Party Details"
      description="Capture billing, registration, and credit defaults for debtor or creditor ledgers."
    >
      <div className="space-y-6">
        {/* GSTIN + Fetch */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <Field label="GSTIN">
              <Input
                placeholder="15-digit GSTIN"
                value={p.gstin}
                maxLength={15}
                onChange={(e: TextFieldChangeEvent) =>
                  updateParty({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })
                }
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={onFetchGstDetails}
            disabled={isFetchingGst || p.gstin.length !== 15}
            className="h-11 w-full sm:w-auto rounded-xl bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:shadow-none disabled:cursor-not-allowed border border-emerald-200 shadow-sm flex items-center justify-center"
          >
            {isFetchingGst ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" className="opacity-75" />
                </svg>
                Fetching...
              </span>
            ) : (
              "Fetch Details"
            )}
          </button>
        </div>

        <Field label="Mailing Name">
          <Input
            placeholder="Mailing name"
            value={p.mailing_name}
            onChange={(e: TextFieldChangeEvent) => updateParty({ mailing_name: e.target.value })}
          />
        </Field>

        <Field label="Address">
          <Input
            type="textarea"
            placeholder="Billing address"
            value={p.address}
            onChange={(e: TextFieldChangeEvent) => updateParty({ address: e.target.value })}
          />
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="State">
            <Input
              placeholder="State"
              value={p.state}
              onChange={(e: TextFieldChangeEvent) => updateParty({ state: e.target.value })}
            />
          </Field>
          <Field label="Country">
            <Input
              placeholder="Country"
              value={p.country}
              onChange={(e: TextFieldChangeEvent) => updateParty({ country: e.target.value })}
            />
          </Field>
          <Field label="Pincode">
            <Input
              placeholder="Pincode"
              value={p.pincode}
              onChange={(e: TextFieldChangeEvent) => updateParty({ pincode: e.target.value })}
            />
          </Field>
          <Field label="PAN Number">
            <Input
              placeholder="PAN number"
              value={p.pan_number}
              onChange={(e: TextFieldChangeEvent) =>
                updateParty({ pan_number: e.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="GST Registration Type">
            <Select
              value={p.gst_registration_type}
              onChange={(e: SelectFieldChangeEvent) =>
                updateParty({
                  gst_registration_type: e.target.value as LedgerFormState["party_details"]["gst_registration_type"],
                })
              }
            >
              <option value="">Select type</option>
              <option value="Regular">Regular</option>
              <option value="Composition">Composition</option>
              <option value="Unregistered">Unregistered</option>
              <option value="Consumer">Consumer</option>
            </Select>
          </Field>
        </div>

        {templateType !== "bank" && (
          <LabeledToggle
            checked={p.maintain_bill_by_bill}
            label="Maintain bill-by-bill"
            description="Useful for receivables and payables tracking."
            onChange={(next) => updateParty({ maintain_bill_by_bill: next })}
          />
        )}

        {templateType !== "bank" && (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Default Credit Days">
                <Input
                  type="number"
                  placeholder="0"
                  value={p.default_credit_days || ""}
                  onChange={(e: TextFieldChangeEvent) =>
                    updateParty({ default_credit_days: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <LabeledToggle
              checked={false}
              label="Check for credit days during voucher entry"
              onChange={() => {}}
            />

            <LabeledToggle
              checked={false}
              label="Set/Alter additional GST details"
              onChange={() => {}}
            />
          </>
        )}
      </div>
    </SurfaceCard>
  );
}
