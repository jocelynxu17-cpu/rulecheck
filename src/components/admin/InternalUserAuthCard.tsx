"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  userId: string;
  initialBanned: boolean;
};

export function InternalUserAuthCard({ userId, initialBanned }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function postAuth(action: string) {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/auth`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; message?: string; banned?: boolean };
      if (!res.ok || body.ok === false) {
        toast.error("操作失敗", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      if (body.message) {
        toast.success("已完成", { description: body.message });
      } else if (action === "disable_account") {
        toast.success("帳號已停用");
      } else if (action === "enable_account") {
        toast.success("帳號已啟用");
      } else {
        toast.success("已完成");
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">驗證與安全</CardTitle>
        <CardDescription>
          不會顯示亦無法讀取密碼。重設流程僅在伺服器觸發（<code className="rounded bg-canvas px-1 font-mono text-[11px]">generateLink</code>
          ），瀏覽器不會收到重設連結內容。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">密碼</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={busy !== null}
              onClick={() => void postAuth("send_password_recovery")}
            >
              {busy === "send_password_recovery" ? "處理中…" : "寄送密碼重設流程"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              disabled={busy !== null}
              onClick={() => void postAuth("force_password_recovery")}
            >
              {busy === "force_password_recovery" ? "處理中…" : "再次觸發重設（強制）"}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-secondary">
            「強制」仍不會變更或顯示密碼，僅重複觸發 recovery 流程並另寫一筆稽核。實際是否寄信取決於專案 Auth 設定。
          </p>
        </div>

        <div className="border-t border-surface-border/80 pt-6 space-y-3">
          <p className="text-sm font-medium text-ink">帳號狀態（Auth）</p>
          <p className="text-xs text-ink-secondary">目前：{initialBanned ? "已停用（ban）" : "使用中"}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              className="rounded-xl bg-red-700 hover:bg-red-700/90"
              disabled={busy !== null || initialBanned}
              onClick={() => void postAuth("disable_account")}
            >
              {busy === "disable_account" ? "處理中…" : "停用帳號"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={busy !== null || !initialBanned}
              onClick={() => void postAuth("enable_account")}
            >
              {busy === "enable_account" ? "處理中…" : "啟用帳號"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
