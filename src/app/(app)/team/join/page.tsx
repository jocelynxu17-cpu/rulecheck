"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ workspaceName: string; workspaceId: string } | null>(null);

  async function accept() {
    if (!token) {
      toast.error("缺少邀請參數");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string; workspaceId?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法加入");
        return;
      }
      let workspaceName = "工作區";
      if (data.workspaceId) {
        const wr = await fetch("/api/workspaces", { credentials: "same-origin" });
        const list = (await wr.json()) as {
          workspaces?: { id: string; name: string }[];
        };
        workspaceName = list.workspaces?.find((w) => w.id === data.workspaceId)?.name ?? workspaceName;
      }
      setSuccess({ workspaceName, workspaceId: data.workspaceId ?? "" });
      toast.success("已成功加入共用方案");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10">
        <Card className="border-emerald-200/80 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="font-medium text-emerald-950">加入成功</CardTitle>
            <CardDescription className="text-emerald-900/80">
              你已加入「<span className="font-semibold text-emerald-950">{success.workspaceName}</span>
              」。審查額度與紀錄將與此工作區之多帳號共用。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-10 rounded-lg" onClick={() => router.replace("/team")}>
              前往工作區總覽
            </Button>
            <Link
              href="/analyze"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-4 text-sm font-medium text-ink transition hover:bg-zinc-50"
            >
              開始檢測
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>加入共用方案</CardTitle>
          <CardDescription>請確認你正以受邀的 Email 登入，再接受邀請。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-amber-800">網址缺少邀請參數。請向邀請人重新取得完整連結。</p>
          ) : null}
          <Button type="button" className="w-full" disabled={loading || !token} onClick={() => void accept()}>
            {loading ? "處理中…" : "接受邀請"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamJoinPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-ink-secondary">載入…</div>}>
      <JoinInner />
    </Suspense>
  );
}
