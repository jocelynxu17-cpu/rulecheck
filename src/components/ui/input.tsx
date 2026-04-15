import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-xl border border-surface-border bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-secondary/70 focus:border-brand/50 focus:ring-4 focus:ring-brand/15 ${className}`}
        {...props}
      />
    );
  }
);
