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
    className="ui-toolbar-button"
    data-active={isOpen}
    aria-label={isOpen ? closeLabel : openLabel}
    title={isOpen ? closeLabel : openLabel}
  >
    {showIndicator && <span className="ui-toolbar-indicator" />}
    {isOpen ? <X width={16} height={16} /> : children}
  </button>
);
