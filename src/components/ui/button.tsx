import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong text-white shadow-soft hover:brightness-[1.03] active:scale-[0.99]",
  secondary:
    "border border-surface-border bg-white text-ink shadow-sm hover:border-brand/40 hover:shadow-card",
  ghost: "text-ink-secondary hover:bg-brand/5 hover:text-ink",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "primary", size = "md", type = "button", ...props },
  ref
) {
  const sizes = {
    sm: "h-9 rounded-lg px-3 text-sm",
    md: "h-11 rounded-xl px-4 text-sm font-medium",
    lg: "h-12 rounded-xl px-6 text-base font-medium",
  }[size];

  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes} ${className}`}
      {...props}
    />
  );
});
