import React from "react";
import { useRouter } from "next/navigation";
import { useLongPress } from "./useLongPress";

interface SelectionRowProps {
  id: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
  onClickHref?: string;
  children: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

export default function SelectionRow({
  id,
  isSelected,
  isSelectionMode,
  onToggle,
  onLongPress,
  onClickHref,
  children,
  className = "",
  autoFocus = false,
}: SelectionRowProps) {
  const router = useRouter();
  const rowRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoFocus && rowRef.current) {
      // Only auto-focus on desktop (>= 768px)
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        // Small delay to ensure the element is painted and ready
        setTimeout(() => {
          rowRef.current?.focus();
        }, 50);
      }
    }
  }, [autoFocus]);

  const handleLongPress = () => {
    onLongPress(id);
  };

  const handleNativeClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a:not(.selection-row-link)")) {
      return;
    }

    if (isSelectionMode) {
      e.preventDefault();
      onToggle(id);
    } else if (onClickHref) {
      router.push(onClickHref);
    }
  };

  const { onClick: wrapClick, ...pressEvents } = useLongPress(handleLongPress);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      onToggle(id);
    } else if (e.key === "Enter" && !isSelectionMode && onClickHref) {
      router.push(onClickHref);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling as HTMLElement;
      if (next && typeof next.focus === "function") {
        next.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling as HTMLElement;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    }
  };

  return (
    <div
      ref={rowRef}
      {...pressEvents}
      onClick={(e) => wrapClick(e, handleNativeClick)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center gap-4 rounded-3xl border p-5 shadow-sm transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${isSelected
          ? "bg-emerald-50/50 border-emerald-300"
          : "bg-white/92 border-slate-100 hover:border-emerald-200"
        } ${className}`}
    >
      {isSelectionMode && (
        <div className="shrink-0 pl-1">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${isSelected
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 bg-white"
              }`}
          >
            {isSelected && (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
