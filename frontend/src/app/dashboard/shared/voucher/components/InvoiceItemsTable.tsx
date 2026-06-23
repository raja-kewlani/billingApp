import { RefObject, Dispatch, SetStateAction, useState } from "react";
import { InvoiceLineState, TaxMode, EMPTY_INVOICE_LINE } from "../types";
import { ItemDetail } from "@/interfaces/inventory";
import { ComboboxField } from "../../ComboboxField";
import { formatCurrency } from "@/lib/format";
import { recalcLine } from "../utils";
import { MobileItemsWindow } from "./MobileItemsWindow";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

type InvoiceItemsTableProps = {
  invoiceLines: InvoiceLineState[];
  setInvoiceLines: Dispatch<SetStateAction<InvoiceLineState[]>>;
  items: ItemDetail[];
  taxMode: TaxMode;
  readOnly: boolean;
  itemsScrollRef: RefObject<HTMLDivElement | null>;
  showDiscount?: boolean;
  discountType?: "percentage" | "amount";
  onToggleDiscountType?: () => void;
  rateInclusive?: boolean;
};

export function InvoiceItemsTable({
  invoiceLines,
  setInvoiceLines,
  items,
  taxMode,
  readOnly,
  itemsScrollRef,
  showDiscount = false,
  discountType = "percentage",
  onToggleDiscountType,
  rateInclusive = false,
}: InvoiceItemsTableProps) {
  const [isMobileWindowOpen, setIsMobileWindowOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  function updateInvoiceLine(index: number, partial: Partial<InvoiceLineState>) {
    setInvoiceLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const merged = { ...line, ...partial };
        const item = items.find((entry) => entry.id === merged.item_id);
        return recalcLine(merged, item, taxMode, discountType);
      }),
    );
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    updateInvoiceLine(index, {
      item_id: itemId,
      unit_price: item?.default_price || 0,
    });
    setInvoiceLines((prev) => {
      // Auto-append row only on Desktop (we check if we are updating the last row)
      if (index === prev.length - 1 && itemId) {
        return [...prev, { ...EMPTY_INVOICE_LINE }];
      }
      return prev;
    });
  }

  const validMobileLines = invoiceLines.filter((l) => l.item_id);

  return (
    <div className="flex-1 flex flex-col min-h-[250px] bg-slate-50 md:bg-white relative border-t border-slate-200 md:border-none">
      
      {/* ============================================================== */}
      {/* DESKTOP VIEW (Hidden on Mobile)                                */}
      {/* ============================================================== */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-x-auto custom-scrollbar border-b border-slate-100">
        <div className={`min-w-full ${rateInclusive && showDiscount ? 'md:min-w-[1100px]' : 'md:min-w-[1000px]'} flex flex-col flex-1 min-h-0`}>
          {/* Table header */}
          <div className={`shrink-0 grid ${
            rateInclusive && showDiscount ? 'grid-cols-[40px_1fr_90px_90px_140px_120px_130px_140px_40px]' :
            rateInclusive ? 'grid-cols-[40px_1fr_90px_90px_140px_120px_140px_40px]' :
            showDiscount ? 'grid-cols-[40px_1fr_90px_90px_120px_130px_140px_40px]' : 
            'grid-cols-[40px_1fr_90px_90px_120px_140px_40px]'
          } gap-2 border-b border-slate-200 bg-slate-50 pl-4 pr-4 md:pl-5 md:pr-[calc(1.25rem+8px)] py-3 text-[12px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap`}>
            <div className="text-center">#</div>
            <div>Name of Item</div>
            <div>HSN/SAC</div>
            <div>Qty</div>
            {rateInclusive && <div>Rate (Inc. Tax)</div>}
            <div>Rate (₹)</div>
            {showDiscount && (
              <div
                className={`text-center ${!readOnly && onToggleDiscountType ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                onClick={() => !readOnly && onToggleDiscountType && onToggleDiscountType()}
                title={!readOnly ? "Click to toggle discount type" : ""}
              >
                Discount ({discountType === "percentage" ? "%" : "₹"})
              </div>
            )}
            <div className="text-right">Amount (₹)</div>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar" ref={itemsScrollRef}>
            <div className="divide-y divide-slate-100">
              {invoiceLines.map((line, index) => (
                <div
                  key={index}
                  className={`group grid ${
                    rateInclusive && showDiscount ? 'grid-cols-[40px_1fr_90px_90px_140px_120px_130px_140px_40px]' :
                    rateInclusive ? 'grid-cols-[40px_1fr_90px_90px_140px_120px_140px_40px]' :
                    showDiscount ? 'grid-cols-[40px_1fr_90px_90px_120px_130px_140px_40px]' : 
                    'grid-cols-[40px_1fr_90px_90px_120px_140px_40px]'
                  } items-center gap-2 p-5 py-2 scroll-mt-12 transition-colors duration-100`}
                  style={{ "--tw-bg-opacity": "1" } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--voucher-row-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  <div className="flex h-12 items-center justify-center text-[17px] font-bold text-slate-500">
                    {index + 1}
                  </div>
                  <div className="col-span-1 block">
                    <ComboboxField
                      inline
                      value={line.item_id}
                      onChange={(id) => selectItem(index, id)}
                      options={items.map((item) => ({ value: item.id, label: item.name }))}
                      placeholder="Search or select item…"
                      leftIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                      }
                      dynamicCreateHref="/dashboard/inventory/items"
                      disabled={readOnly}
                      dataItemField={true}
                      mandatory={index === 0 || !!line.item_id}
                    />
                  </div>
                  <div className="block">
                    <div className="mono-num flex h-12 w-full items-center px-2 text-[15px] font-medium text-slate-600 opacity-90">
                      {items.find((i) => i.id === line.item_id)?.hsn_code || "—"}
                    </div>
                  </div>
                  <div className="block">
                    <input
                      disabled={readOnly}
                      type="number"
                      step="0.01"
                      value={line.quantity || ""}
                      onChange={(e) => updateInvoiceLine(index, { quantity: Number(e.target.value) })}
                      placeholder="0"
                      className="mono-num h-12 w-full rounded-lg border border-transparent bg-transparent px-2 text-[17px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-500 focus:border-tally-400 focus:bg-white focus:ring-2 focus:ring-tally-500/[0.16]"
                      data-mandatory={index === 0 || !!line.item_id ? "true" : undefined}
                    />
                  </div>
                  {rateInclusive && (
                    <div className="block">
                      <input
                        disabled={readOnly}
                        type="number"
                        step="0.01"
                        value={line.inclusive_rate || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const item = items.find(i => i.id === line.item_id);
                          let taxRate = 0;
                          if (item?.taxability === 'Taxable') {
                            taxRate = taxMode === 'inter' ? item.igst_rate : (item.cgst_rate + item.sgst_rate);
                          }
                          const unitPrice = Math.round((val / (1 + taxRate/100)) * 100) / 100;
                          updateInvoiceLine(index, { inclusive_rate: val, unit_price: unitPrice });
                        }}
                        placeholder="0.00"
                        className="mono-num h-12 w-full rounded-lg border border-transparent bg-transparent px-2 text-[17px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-500 focus:border-tally-400 focus:bg-white focus:ring-2 focus:ring-tally-500/[0.16]"
                      />
                    </div>
                  )}
                  <div className="block">
                    <input
                      disabled={readOnly}
                      type="number"
                      step="0.01"
                      value={line.unit_price || ""}
                      onChange={(e) => updateInvoiceLine(index, { unit_price: Number(e.target.value), inclusive_rate: 0 })}
                      placeholder="0.00"
                      className="mono-num h-12 w-full rounded-lg border border-transparent bg-transparent px-2 text-[17px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-500 focus:border-tally-400 focus:bg-white focus:ring-2 focus:ring-tally-500/[0.16]"
                      data-mandatory={index === 0 || !!line.item_id ? "true" : undefined}
                    />
                  </div>
                  {showDiscount && (
                    <div className="block">
                      <input
                        disabled={readOnly}
                        type="number"
                        step="0.01"
                        value={discountType === "percentage" ? (line.discount_percent || "") : (line.discount_amount || "")}
                        onChange={(e) => {
                          if (discountType === "percentage") {
                            updateInvoiceLine(index, { discount_percent: Number(e.target.value) });
                          } else {
                            updateInvoiceLine(index, { discount_amount: Number(e.target.value) });
                          }
                        }}
                        placeholder={discountType === "percentage" ? "0" : "0.00"}
                        className="mono-num h-12 w-full rounded-lg border border-transparent bg-transparent px-2 text-[17px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-500 focus:border-tally-400 focus:bg-white focus:ring-2 focus:ring-tally-500/[0.16]"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-end pr-1">
                    <span className="mono-num text-[17px] font-bold text-slate-900">
                      {formatCurrency(line.taxable_amount)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {!readOnly && (
                      <button
                        data-skip-enter="true"
                        onClick={() => setInvoiceLines((prev) => prev.filter((_, i) => i !== index))}
                        title="Remove line"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 transition-colors hover:text-rose-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              {!readOnly && (
                <button
                  data-skip-enter="true"
                  onClick={() => setInvoiceLines((prev) => [...prev, { ...EMPTY_INVOICE_LINE }])}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 shadow-sm bg-emerald-50/50 px-3 py-1.5 text-[15px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {/* Changed text below */}
                  Add Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE VIEW SUMMARY (Hidden on Desktop)                        */}
      {/* ============================================================== */}
      <div className="md:hidden flex-1 flex flex-col p-4 gap-3 pb-8">
        
        {/* Section Header */}
        <h3 className="ml-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-700">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          Item Details
        </h3>

        {validMobileLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-slate-300 bg-white">
            <p className="text-slate-400 font-medium text-sm">No items added to invoice</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm mt-1">
            {validMobileLines.map((line, idx) => {
              const item = items.find((i) => i.id === line.item_id);
              return (
                <div key={idx} className="flex p-4 gap-3 relative">
                  {/* Numbering Outside */}
                  <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold mt-0.5">
                    {idx + 1}
                  </div>
                  
                  {/* Content block */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[15px] font-bold text-slate-800 leading-tight">
                        {item?.name || "Unknown Item"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-slate-900 mono-num">
                          {formatCurrency(line.taxable_amount)}
                        </span>
                        {!readOnly && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setIsMobileWindowOpen(true)}
                              className="flex items-center justify-center rounded-md bg-slate-50 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setItemToDelete(idx)}
                              className="flex items-center justify-center rounded-md bg-rose-50/50 p-1.5 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-slate-500 font-medium">
                      <span className="mono-num">{line.quantity} QTY × {formatCurrency(line.unit_price)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <button
            onClick={() => setIsMobileWindowOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-400 bg-white py-3 text-[15px] font-bold text-blue-600 shadow-sm active:bg-blue-50 transition-colors mt-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {validMobileLines.length > 0 ? "Edit Invoice Items" : "Add Line Item"}
          </button>
        )}
      </div>

      {isMobileWindowOpen && (
        <MobileItemsWindow
          invoiceLines={invoiceLines}
          setInvoiceLines={setInvoiceLines}
          items={items}
          taxMode={taxMode}
          readOnly={readOnly}
          onClose={() => setIsMobileWindowOpen(false)}
          showDiscount={showDiscount}
          discountType={discountType}
          onToggleDiscountType={onToggleDiscountType}
          rateInclusive={rateInclusive}
        />
      )}

      <ConfirmDeleteModal
        isOpen={itemToDelete !== null}
        itemName={itemToDelete !== null && items.find(i => i.id === validMobileLines[itemToDelete]?.item_id)?.name || "this item"}
        itemAmount={itemToDelete !== null ? validMobileLines[itemToDelete]?.taxable_amount || 0 : 0}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete !== null) {
            // Find the actual index in the main array because validMobileLines index might differ if there are empty rows
            const actualLineIndex = invoiceLines.indexOf(validMobileLines[itemToDelete]);
            if (actualLineIndex !== -1) {
              setInvoiceLines(prev => prev.filter((_, i) => i !== actualLineIndex));
            }
          }
          setItemToDelete(null);
        }}
      />
    </div>
  );
}
