"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "border border-surface-border bg-white text-ink shadow-soft rounded-xl font-sans",
          title: "font-medium text-ink",
          description: "text-ink-secondary text-sm",
        },
      }}
    />
  );
}
