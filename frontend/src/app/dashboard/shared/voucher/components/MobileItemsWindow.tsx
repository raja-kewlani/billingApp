import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { InvoiceLineState, TaxMode, EMPTY_INVOICE_LINE } from "../types";
import { ItemDetail } from "@/interfaces/inventory";
import { ComboboxField } from "../../ComboboxField";
import { formatCurrency } from "@/lib/format";
import { recalcLine } from "../utils";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

type MobileItemsWindowProps = {
  invoiceLines: InvoiceLineState[];
  setInvoiceLines: Dispatch<SetStateAction<InvoiceLineState[]>>;
  items: ItemDetail[];
  taxMode: TaxMode;
  readOnly: boolean;
  onClose: () => void;
  showDiscount?: boolean;
  discountType?: "percentage" | "amount";
  onToggleDiscountType?: () => void;
  rateInclusive?: boolean;
};

export function MobileItemsWindow({
  invoiceLines,
  setInvoiceLines,
  items,
  taxMode,
  readOnly,
  onClose,
  showDiscount = false,
  discountType = "percentage",
  onToggleDiscountType,
  rateInclusive = false,
}: MobileItemsWindowProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  useEffect(() => {
    const emptyIndex = invoiceLines.findIndex(l => !l.item_id);
    if (emptyIndex !== -1) {
      setEditingItemIndex(emptyIndex);
    }
  }, []);

  useEffect(() => {
    if (editingItemIndex !== null) {
      setTimeout(() => {
        const el = document.getElementById(`item-card-${editingItemIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }, [editingItemIndex]);

  function toggleExpanded(index: number) {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }

  function toggleEditing(index: number) {
    setEditingItemIndex(prev => prev === index ? null : index);
  }

  function getIsEditing(index: number) {
    return editingItemIndex === index;
  }

  function updateInvoiceLine(index: number, partial: Partial<InvoiceLineState>) {
    setInvoiceLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const merged = { ...line, ...partial };
        const item = items.find((entry) => entry.id === merged.item_id);
        return recalcLine(merged, item, taxMode, discountType, rateInclusive);
      }),
    );
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    updateInvoiceLine(index, {
      item_id: itemId,
      unit_price: item?.default_price || 0,
    });
  }

  const validItemsCount = invoiceLines.filter(l => l.item_id).length;
  const totalAmount = invoiceLines.reduce((sum, line) => {
    return sum + (line.taxable_amount || 0) + (line.igst_amount || 0) + (line.cgst_amount || 0) + (line.sgst_amount || 0);
  }, 0);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 md:hidden animate-in slide-in-from-bottom-full duration-300">
      {/* Sleek Premium Header */}
      <div className="flex h-14 shrink-0 items-center justify-between bg-white px-4 border-b border-slate-100 shadow-sm relative z-10">
        <div className="w-8"></div> {/* Spacer for perfect centering */}
        <h2 className="text-[16px] font-bold text-slate-700 tracking-tight">Manage Items</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 active:bg-slate-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 pb-32 space-y-4 bg-slate-50">
        {invoiceLines.map((line, index) => {
          const item = items.find((i) => i.id === line.item_id);
          const isExpanded = expandedItems[index];
          const isEditing = getIsEditing(index);

          return (
            <div key={index} id={`item-card-${index}`} className={`rounded-lg border ${isEditing ? 'border-emerald-300 shadow-md ring-2 ring-emerald-50' : 'border-blue-200/60 shadow-sm'} bg-white p-3 flex flex-col gap-3 transition-all duration-200`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-black tracking-widest text-amber-600 uppercase ml-1">
                  ITEM {index + 1}
                </span>
                {!readOnly && (
                  <div className="flex items-center gap-1 -mr-1">
                    <button
                      onClick={() => toggleEditing(index)}
                      className={`p-1.5 rounded-md transition-colors ${isEditing ? 'bg-emerald-100 text-emerald-700' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setItemToDelete(index)}
                      className="p-1.5 rounded-md transition-colors text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Combobox */}
              <div className={`rounded-md border relative transition-colors ${isEditing ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
                <ComboboxField
                  inline
                  value={line.item_id}
                  onChange={(id) => selectItem(index, id)}
                  options={items.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder="Search item..."
                  leftIcon={
                    <svg className="h-4 w-4 ml-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  }
                  dynamicCreateHref="/dashboard/inventory/items"
                  disabled={readOnly || !isEditing}
                  dataItemField={true}
                />
                {!isEditing && <div className="absolute inset-0 cursor-pointer" onClick={() => toggleEditing(index)} />}
              </div>

              {/* Amount Box */}
              <div className={`flex flex-col rounded-md border overflow-hidden transition-colors ${isEditing ? 'border-[#d3ecd9] bg-[#f2fcf5]' : 'border-blue-100 bg-blue-50/40'}`}>
                <div className="flex items-center justify-between p-2 px-3">
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold uppercase mb-0 tracking-wider ${isEditing ? 'text-[#5d957b]' : 'text-blue-600'}`}>Amount</span>
                    <span className={`text-[18px] font-bold mono-num tracking-tight leading-none ${isEditing ? 'text-[#2f7a55]' : 'text-blue-700'}`}>
                      {formatCurrency(line.taxable_amount)}
                    </span>
                  </div>
                  <button 
                    onClick={() => toggleExpanded(index)}
                    className={`text-[12px] font-semibold flex items-center gap-1 active:opacity-70 transition-opacity ${isEditing ? 'text-[#5d957b]' : 'text-blue-600'}`}
                  >
                    View Details
                    <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
                
                {/* Expanded Details / Tax Breakdown */}
                {isExpanded && (
                  <div className={`px-3 pb-2 pt-1 border-t mx-3 ${isEditing ? 'border-[#d3ecd9]/50' : 'border-blue-100'}`}>
                    <div className="grid grid-cols-2 gap-y-1 mt-1">
                      <div className="flex flex-col">
                        <span className={`text-[9px] font-bold uppercase ${isEditing ? 'text-[#5d957b]/80' : 'text-blue-500'}`}>Taxable Amt</span>
                        <span className={`text-xs font-semibold mono-num ${isEditing ? 'text-slate-700' : 'text-blue-800'}`}>{formatCurrency(line.taxable_amount)}</span>
                      </div>
                      
                      {/* Dynamic Tax Display */}
                      {taxMode === "inter" ? (
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-bold uppercase ${isEditing ? 'text-[#5d957b]/80' : 'text-blue-500'}`}>IGST ({line.igst_rate || 0}%)</span>
                          <span className={`text-xs font-semibold mono-num ${isEditing ? 'text-slate-700' : 'text-blue-800'}`}>{formatCurrency(line.igst_amount || 0)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-bold uppercase ${isEditing ? 'text-[#5d957b]/80' : 'text-blue-500'}`}>CGST ({line.cgst_rate || 0}%)</span>
                            <span className={`text-xs font-semibold mono-num ${isEditing ? 'text-slate-700' : 'text-blue-800'}`}>{formatCurrency(line.cgst_amount || 0)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-bold uppercase ${isEditing ? 'text-[#5d957b]/80' : 'text-blue-500'}`}>SGST ({line.sgst_rate || 0}%)</span>
                            <span className={`text-xs font-semibold mono-num ${isEditing ? 'text-slate-700' : 'text-blue-800'}`}>{formatCurrency(line.sgst_amount || 0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className={`grid grid-cols-2 border rounded-md overflow-hidden mt-0 transition-colors ${isEditing ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                {/* HSN/SAC */}
                <div className={`flex flex-col p-2.5 px-3 border-b border-r ${isEditing ? 'border-slate-200/60' : 'border-slate-200'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500`}>HSN/SAC</span>
                  <span className={`text-[14px] font-semibold mono-num ${isEditing ? 'text-slate-800' : 'text-slate-700'}`}>{item?.hsn_code || "—"}</span>
                </div>
                {/* QTY */}
                <div className={`flex flex-col p-2.5 px-3 border-b relative ${isEditing ? 'border-slate-200/60 bg-white' : 'border-slate-200 bg-white'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500`}>QTY</span>
                  {isEditing ? (
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-transparent text-[14px] font-semibold text-slate-800 outline-none mono-num placeholder:text-slate-300"
                      value={line.quantity || ""}
                      onChange={(e) => updateInvoiceLine(index, { quantity: Number(e.target.value) })}
                      placeholder="0"
                      disabled={readOnly}
                    />
                  ) : (
                    <span className={`text-[14px] font-semibold mono-num ${isEditing ? 'text-slate-800' : 'text-slate-700'}`}>{line.quantity || "0"}</span>
                  )}
                  {!isEditing && <div className="absolute inset-0 cursor-pointer" onClick={() => toggleEditing(index)} />}
                </div>
                {/* RATE (INC. TAX) */}
                {rateInclusive && (
                  <div className={`flex flex-col p-2.5 px-3 border-r relative border-b ${isEditing ? 'border-slate-200/60 bg-white' : 'border-slate-200 bg-white'}`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500`}>RATE (INC. TAX) (₹)</span>
                    {isEditing ? (
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full bg-transparent text-[14px] font-semibold text-slate-800 outline-none mono-num placeholder:text-slate-300"
                        value={line.inclusive_rate || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const item = items.find(i => i.id === line.item_id);
                          let taxRate = 0;
                          if (item?.taxability === 'Taxable') {
                            taxRate = taxMode === 'inter' ? item.igst_rate : (item.cgst_rate + item.sgst_rate);
                          }
                          const unitPrice = val / (1 + taxRate/100);
                          updateInvoiceLine(index, { inclusive_rate: val, unit_price: unitPrice });
                        }}
                        placeholder="0.00"
                        disabled={readOnly}
                      />
                    ) : (
                      <span className={`text-[14px] font-semibold mono-num ${isEditing ? 'text-slate-800' : 'text-slate-700'}`}>{line.inclusive_rate || "0.00"}</span>
                    )}
                    {!isEditing && <div className="absolute inset-0 cursor-pointer" onClick={() => toggleEditing(index)} />}
                  </div>
                )}
                {/* RATE */}
                <div className={`flex flex-col p-2.5 px-3 border-r relative ${rateInclusive ? 'border-b' : ''} ${isEditing ? 'border-slate-200/60 bg-white' : 'border-slate-200 bg-white'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500`}>RATE (₹)</span>
                  {isEditing ? (
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-transparent text-[14px] font-semibold text-slate-800 outline-none mono-num placeholder:text-slate-300"
                      value={line.unit_price || ""}
                      onChange={(e) => updateInvoiceLine(index, { unit_price: Number(e.target.value), inclusive_rate: 0 })}
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                  ) : (
                    <span className={`text-[14px] font-semibold mono-num ${isEditing ? 'text-slate-800' : 'text-slate-700'}`}>{line.unit_price || "0.00"}</span>
                  )}
                  {!isEditing && <div className="absolute inset-0 cursor-pointer" onClick={() => toggleEditing(index)} />}
                </div>
                {/* DISCOUNT */}
                {showDiscount && (
                  <div className={`flex flex-col p-2.5 px-3 relative ${isEditing ? 'bg-white' : 'bg-white'}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wider text-slate-500`}>DISCOUNT ({discountType === "percentage" ? "%" : "₹"})</span>
                      {isEditing && onToggleDiscountType && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleDiscountType();
                          }}
                          className="flex items-center justify-center rounded-sm bg-slate-100 p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full bg-transparent text-[14px] font-semibold text-slate-800 outline-none mono-num placeholder:text-slate-300"
                        value={discountType === "percentage" ? (line.discount_percent || "") : (line.discount_amount || "")}
                        onChange={(e) => {
                          if (discountType === "percentage") {
                            updateInvoiceLine(index, { discount_percent: Number(e.target.value) });
                          } else {
                            updateInvoiceLine(index, { discount_amount: Number(e.target.value) });
                          }
                        }}
                        placeholder={discountType === "percentage" ? "0" : "0.00"}
                        disabled={readOnly}
                      />
                    ) : (
                      <span className={`text-[14px] font-semibold mono-num ${isEditing ? 'text-slate-800' : 'text-slate-700'}`}>
                        {discountType === "percentage" ? `${line.discount_percent || "0"}%` : formatCurrency(line.discount_amount || 0)}
                      </span>
                    )}
                    {!isEditing && <div className="absolute inset-0 cursor-pointer" onClick={() => toggleEditing(index)} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Line Item Button - sharper curves */}
        {!readOnly && (
          <button
            onClick={() => {
              setInvoiceLines((prev) => [...prev, { ...EMPTY_INVOICE_LINE }]);
              setEditingItemIndex(invoiceLines.length); // The new index becomes active
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-400 bg-white py-3 text-[15px] font-bold text-blue-600 active:bg-blue-50 transition-colors mt-2 shadow-sm"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Line Item
          </button>
        )}
      </div>

      {/* Footer Fixed Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-transparent pb-safe pointer-events-none z-50">
        <div className="pointer-events-auto flex items-center justify-between rounded-[20px] bg-white p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100/80">
          <div className="flex items-center gap-3 pl-1">
            {/* Blue "Save/Document" Icon as requested */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-semibold text-slate-400 leading-tight">Total Items</span>
              <span className="text-[13px] font-bold text-slate-800 leading-tight mb-1">{validItemsCount} Items</span>
              <span className="text-[10px] font-semibold text-slate-400 leading-tight">Total Amount</span>
              <span className="text-[15px] font-bold text-orange-600 leading-none mono-num">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
          
          <div className="h-10 w-[1px] bg-slate-100 mx-1 shrink-0"></div>
          
          <button
            onClick={onClose}
            className="flex h-12 flex-1 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-[#5d957b] px-3 text-[15px] font-semibold text-white shadow-md shadow-[#5d957b]/20 transition-transform active:scale-[0.98] ml-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 3H6.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V5.5L17.5 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v5H9V3m-1 11h8v6H8v-6z" />
            </svg>
            <span>Done & Save</span>
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={itemToDelete !== null}
        itemName={itemToDelete !== null && invoiceLines[itemToDelete] ? items.find(i => i.id === invoiceLines[itemToDelete].item_id)?.name || "this empty item" : "this item"}
        itemAmount={itemToDelete !== null && invoiceLines[itemToDelete] ? invoiceLines[itemToDelete].taxable_amount || 0 : 0}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete !== null) {
            setInvoiceLines((prev) => prev.filter((_, i) => i !== itemToDelete));
            if (editingItemIndex === itemToDelete) {
              setEditingItemIndex(null);
            } else if (editingItemIndex !== null && editingItemIndex > itemToDelete) {
              setEditingItemIndex(editingItemIndex - 1);
            }
          }
          setItemToDelete(null);
        }}
      />
    </div>,
    document.body
  );
}
