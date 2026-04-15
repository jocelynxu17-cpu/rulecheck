import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={`min-h-[180px] w-full resize-y rounded-xl border border-surface-border bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-sm outline-none transition placeholder:text-ink-secondary/70 focus:border-brand/50 focus:ring-4 focus:ring-brand/15 ${className}`}
        {...props}
      />
    );
  }
);
