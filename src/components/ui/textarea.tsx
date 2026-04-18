import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-[200px] w-full resize-y rounded-xl border border-surface-border bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-none outline-none transition placeholder:text-ink-secondary/60 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 ${className}`}
      {...props}
    />
  );
}
