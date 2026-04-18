import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-strong text-white shadow-none hover:bg-brand-strong/90 active:scale-[0.99]",
  secondary:
    "border border-surface-border bg-white text-ink shadow-none hover:bg-zinc-50 hover:border-zinc-300/80",
  ghost: "text-ink-secondary hover:bg-zinc-100/80 hover:text-ink",
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
    sm: "h-9 rounded-md px-3 text-sm",
    md: "h-10 rounded-lg px-4 text-sm font-medium",
    lg: "h-11 rounded-lg px-5 text-[15px] font-medium",
  }[size];

  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes} ${className}`}
      {...props}
    />
  );
});
