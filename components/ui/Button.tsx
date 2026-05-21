"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "white" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-[#1D4ED8] hover:bg-[#1E40AF] active:bg-[#1e3a8a] text-white border-transparent shadow-[0_0_0_0_#3B82F6] hover:shadow-[0_0_16px_rgba(29,78,216,0.5)]",
  secondary:
    "bg-[#1E293B] hover:bg-[#263348] active:bg-[#1E293B] text-[#F1F5F9] border-[#334155]",
  ghost:
    "bg-transparent hover:bg-[#1E293B] active:bg-[#1E293B] text-[#94A3B8] border-transparent",
  danger:
    "bg-[#EF4444]/10 hover:bg-[#EF4444]/20 active:bg-[#EF4444]/30 text-[#EF4444] border-[#EF4444]/30",
  white:
    "bg-white hover:bg-gray-100 active:bg-gray-200 text-[#1D4ED8] border-transparent font-bold",
  success:
    "bg-[#22C55E]/10 hover:bg-[#22C55E]/20 active:bg-[#22C55E]/30 text-[#22C55E] border-[#22C55E]/30",
};

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function Button({
  variant = "primary",
  children,
  loading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2",
        "min-h-[44px] px-5 py-2.5",
        "rounded-xl border font-medium text-sm",
        "transition-all duration-150 ease-in-out",
        "touch-feedback",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANT_STYLES[variant],
        className,
      ].join(" ")}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
