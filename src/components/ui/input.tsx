import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink shadow-none outline-none transition placeholder:text-ink-secondary/60 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 ${className}`}
      {...props}
    />
  );
}
