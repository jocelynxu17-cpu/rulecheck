"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NotifyProButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const t = toast.loading("送出中…");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        mode?: string;
        checkoutUrl?: string | null;
      };
      if (!res.ok) {
        toast.dismiss(t);
        toast.error(data.error ?? "無法送出，請稍後再試");
        return;
      }
      if (data.mode === "redirect" && data.checkoutUrl) {
        toast.dismiss(t);
        window.location.href = data.checkoutUrl;
        return;
      }
      toast.dismiss(t);
      toast.success(data.message ?? "已收到");
    } catch {
      toast.dismiss(t);
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className="h-11 rounded-lg" disabled={disabled || loading} onClick={() => void go()}>
        {loading ? "送出中…" : "通知我開通"}
      </Button>
      <p className="text-center text-xs font-medium text-ink-secondary">即將開放</p>
    </div>
  );
}
