import React from "react";
import { X } from "lucide-react";

interface PanelToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  openLabel: string;
  closeLabel: string;
  children: React.ReactNode;
}

export const PanelToggleButton: React.FC<PanelToggleButtonProps> = ({
  isOpen,
  onClick,
  openLabel,
  closeLabel,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-lg transition-colors hover:bg-zinc-800 hover:text-white"
    aria-label={isOpen ? closeLabel : openLabel}
    title={isOpen ? closeLabel : openLabel}
  >
    {isOpen ? <X width={16} height={16} /> : children}
  </button>
);
