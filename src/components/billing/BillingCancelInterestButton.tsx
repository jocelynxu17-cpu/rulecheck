"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BillingCancelInterestButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const t = toast.loading("載入中…");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast.dismiss(t);
        toast.error(data.error ?? "無法處理，請稍後再試");
        return;
      }
      toast.dismiss(t);
      toast.message(data.message ?? "已更新");
    } catch {
      toast.dismiss(t);
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className="h-11 rounded-xl" disabled={disabled || loading} onClick={() => void go()}>
      {loading ? "處理中…" : "訂閱與週期說明"}
    </Button>
  );
}
