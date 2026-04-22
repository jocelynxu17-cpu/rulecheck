"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

type Preview = {
  workspaceName: string;
  plan: string;
  inviteRole: string;
  inviteEmail: string;
  expiresAt: string;
  status: "pending" | "expired" | "revoked" | "accepted";
};

function roleLabel(role: string) {
  if (role === "admin") return "管理員";
  return "成員";
}

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { refresh: refreshWs, setSelectedId } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(Boolean(token));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ workspaceName: string; workspaceId: string; role: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/workspaces/invites/preview?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as Preview & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setPreviewError(data.error ?? "無法載入邀請");
          setPreview(null);
          return;
        }
        setPreviewError(null);
        setPreview({
          workspaceName: data.workspaceName,
          plan: data.plan,
          inviteRole: data.inviteRole,
          inviteEmail: data.inviteEmail,
          expiresAt: data.expiresAt,
          status: data.status,
        });
      } catch {
        if (!cancelled) setPreviewError("網路錯誤");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string; workspaceId?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法加入");
        return;
      }
      const joinedRole = preview?.inviteRole ?? "member";
      let workspaceName = preview?.workspaceName ?? "工作區";
      if (data.workspaceId) {
        const wr = await fetch("/api/workspaces", { credentials: "same-origin" });
        const list = (await wr.json()) as {
          workspaces?: { id: string; name: string }[];
        };
        workspaceName = list.workspaces?.find((w) => w.id === data.workspaceId)?.name ?? workspaceName;
      }
      await refreshWs();
      if (data.workspaceId) {
        setSelectedId(data.workspaceId);
      }
      setSuccess({ workspaceName, workspaceId: data.workspaceId ?? "", role: joinedRole });
      toast.success("已成功加入工作區", {
        description: "已切換為此工作區；你可立即開始檢測或前往總覽。",
      });
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
              」，角色為「{roleLabel(success.role)}」。此後與其他成員共用此工作區之審查額度與分析紀錄（依權限）。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="button" className="h-10 rounded-lg" onClick={() => router.replace("/dashboard")}>
              前往儀表板
            </Button>
            <Button type="button" variant="secondary" className="h-10 rounded-lg" onClick={() => router.replace("/members")}>
              工作區總覽
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

  const statusBadge = preview
    ? preview.status === "pending"
      ? { label: "待加入", tone: "blue" as const }
      : preview.status === "expired"
        ? { label: "已過期", tone: "amber" as const }
        : preview.status === "revoked"
          ? { label: "已撤銷", tone: "neutral" as const }
          : { label: "已加入", tone: "emerald" as const }
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>加入工作區</CardTitle>
          <CardDescription>請確認你正以受邀的 Email 登入，再接受邀請。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-amber-800">網址缺少邀請參數。請向邀請人重新取得完整連結。</p>
          ) : null}

          {previewLoading ? <p className="text-sm text-ink-secondary">載入邀請資訊…</p> : null}

          {!previewLoading && previewError ? <p className="text-sm text-amber-900">{previewError}</p> : null}

          {!previewLoading && preview ? (
            <div className="space-y-3 rounded-xl border border-surface-border bg-canvas px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{preview.workspaceName}</span>
                <Badge tone="blue">{preview.plan === "pro" ? "Pro" : "Free"}</Badge>
                {statusBadge ? <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge> : null}
              </div>
              <p className="text-ink-secondary">
                受邀信箱：<span className="font-medium text-ink">{preview.inviteEmail}</span>
              </p>
              <p className="text-ink-secondary">
                將授予角色：<span className="font-medium text-ink">{roleLabel(preview.inviteRole)}</span>
              </p>
              <p className="text-xs text-ink-secondary">
                邀請到期：{new Date(preview.expiresAt).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          ) : null}

          {!previewLoading && preview && preview.status !== "pending" ? (
            <p className="text-sm text-amber-900">
              {preview.status === "expired"
                ? "此邀請已過期，請聯絡管理員重新寄送。"
                : preview.status === "revoked"
                  ? "此邀請已撤銷。"
                  : "此邀請已完成。"}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={loading || !token || previewLoading || !preview || preview.status !== "pending"}
            onClick={() => void accept()}
          >
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
