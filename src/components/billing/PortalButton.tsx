"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PortalButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const t = toast.loading("正在開啟客戶入口…");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        toast.dismiss(t);
        toast.error(data.error ?? "無法開啟客戶入口");
        return;
      }
      if (data.url) {
        toast.dismiss(t);
        toast.success("即將前往 Stripe 管理訂閱");
        window.location.href = data.url;
        return;
      }
      toast.dismiss(t);
      toast.error("無法取得入口連結");
    } catch {
      toast.dismiss(t);
      toast.error("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <Button type="button" variant="secondary" disabled={disabled || loading} onClick={() => void go()}>
        {loading ? "開啟中…" : "管理付款方式"}
      </Button>
    </div>
  );
}
