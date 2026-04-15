"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CheckoutButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const t = toast.loading("正在建立結帳工作階段…");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        toast.dismiss(t);
        toast.error(data.error ?? "無法建立結帳工作階段");
        return;
      }
      if (data.url) {
        toast.dismiss(t);
        toast.success("即將前往 Stripe 完成付款");
        window.location.href = data.url;
        return;
      }
      toast.dismiss(t);
      toast.error("無法取得結帳連結");
    } catch {
      toast.dismiss(t);
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <Button type="button" disabled={disabled || loading} onClick={() => void go()}>
        {loading ? "處理中…" : disabled ? "已是 Pro" : "升級 Pro"}
      </Button>
    </div>
  );
}
