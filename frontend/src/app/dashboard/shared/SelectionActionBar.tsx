import React, { useState } from "react";
import { ConfirmModal } from "./WorkspaceUi";

interface SelectionActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export default function SelectionActionBar({
  selectedCount,
  onClear,
  onDelete,
  isDeleting = false,
}: SelectionActionBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-md sm:max-w-lg lg:max-w-2xl transform transition-all duration-300">
      <div className="flex items-center justify-between rounded-[24px] bg-slate-900 px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.25)] sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onClear}
            className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="Clear selection"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm sm:text-base font-bold text-white">
            {selectedCount} selected
          </span>
        </div>
        
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isDeleting}
          className="flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold tracking-wide text-rose-400 transition-colors hover:bg-rose-500/30 disabled:opacity-50"
        >
          {isDeleting ? (
            <span>Deleting...</span>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              <span>Delete</span>
            </>
          )}
        </button>
      </div>
    </div>

    <ConfirmModal
      isOpen={showConfirm}
      title="Delete forever?"
      message={`Permanently delete ${selectedCount} selected items? This cannot be undone.`}
      confirmLabel={isDeleting ? "Deleting..." : "Delete forever"}
      cancelLabel="Cancel"
      onConfirm={() => {
        onDelete();
        // Modal will close either after success/failure by parent resetting state or we could do it here
        // If we close immediately, it looks abrupt.
      }}
      onCancel={() => setShowConfirm(false)}
      isDanger={true}
    />
    </>
  );
}
