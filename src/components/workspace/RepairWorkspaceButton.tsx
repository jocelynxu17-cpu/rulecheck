"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** POST /api/workspaces/ensure then refresh — for server-rendered pages without WorkspaceContext. */
export function RepairWorkspaceButton({ label = "建立／修復工作區" }: { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const res = await fetch("/api/workspaces/ensure", { method: "POST", credentials: "same-origin" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        toast.error("仍無法建立工作區", { description: "請確認資料庫已套用最新 migration，或稍後再試。" });
        return;
      }
      toast.success("工作區已就緒", { description: "多帳號可共用此工作區之共用審查額度。" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" className="rounded-xl" disabled={pending} onClick={() => void onClick()}>
      {pending ? "處理中…" : label}
    </Button>
  );
}
