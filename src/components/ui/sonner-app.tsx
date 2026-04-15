"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "border border-surface-border bg-white/95 text-ink shadow-card",
          title: "text-sm font-semibold text-ink",
          description: "text-sm text-ink-secondary",
        },
      }}
    />
  );
}
