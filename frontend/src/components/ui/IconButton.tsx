import type { ComponentType } from "react";

interface IconButtonProps {
  icon: ComponentType<{ size?: string | number }>;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function IconButton({ icon: Icon, label, onClick, className = "" }: IconButtonProps) {
  return (
    <button className={`icon-button ${className}`} type="button" title={label} aria-label={label} onClick={onClick}>
      <Icon size={18} />
    </button>
  );
}
