import React from "react";
import { X } from "lucide-react";

interface PanelToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  openLabel: string;
  closeLabel: string;
  showIndicator?: boolean;
  children: React.ReactNode;
}

export const PanelToggleButton: React.FC<PanelToggleButtonProps> = ({
  isOpen,
  onClick,
  openLabel,
  closeLabel,
  showIndicator = false,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
    aria-label={isOpen ? closeLabel : openLabel}
    title={isOpen ? closeLabel : openLabel}
  >
    {showIndicator && (
      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500/80" />
    )}
    {isOpen ? <X width={16} height={16} /> : children}
  </button>
);
