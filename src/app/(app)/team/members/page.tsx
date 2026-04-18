"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type MemberRow = { userId: string; role: string; email: string; createdAt: string };
type UsageRow = {
  id: string;
  userId: string;
  email: string;
  inputType: string;
  unitsCharged: number;
  createdAt: string;
};

export default function TeamMembersPage() {
  const { workspaces, selectedId, loading, refresh: refreshWs } = useWorkspace();
  const ws = workspaces.find((w) => w.id === selectedId) ?? workspaces[0];
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [inviteDone, setInviteDone] = useState<{ email: string; url: string } | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    const [mRes, uRes] = await Promise.all([
      fetch(`/api/workspaces/${ws.id}/members`, { credentials: "same-origin" }),
      fetch(`/api/workspaces/${ws.id}/usage`, { credentials: "same-origin" }),
    ]);
    const mJson = (await mRes.json()) as { members?: MemberRow[] };
    const uJson = (await uRes.json()) as { events?: UsageRow[] };
    if (mRes.ok) setMembers(mJson.members ?? []);
    if (uRes.ok) setUsage(uJson.events ?? []);
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  function canRemoveTarget(target: MemberRow): boolean {
    if (!ws) return false;
    if (!(ws.role === "owner" || ws.role === "admin")) return false;
    if (target.role === "owner") return false;
    if (ws.role === "admin" && target.role === "admin") return false;
    return true;
  }

  async function invite() {
    if (!ws || !inviteEmail.trim()) return;
    setBusy(true);
    setInviteDone(null);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = (await res.json()) as { inviteUrl?: string; error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "邀請失敗");
        return;
      }
      const url = data.inviteUrl ?? "";
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* ignore */
        }
      }
      setInviteDone({ email: inviteEmail.trim(), url });
      toast.success("邀請已建立", {
        description: url ? "邀請連結已複製到剪貼簿，可直接貼給對方。" : undefined,
        duration: 5000,
      });
      setInviteEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copyAgain() {
    if (!inviteDone?.url) return;
    try {
      await navigator.clipboard.writeText(inviteDone.url);
      toast.message("已再次複製邀請連結");
    } catch {
      toast.error("無法複製，請手動選取下方連結");
    }
  }

  async function remove(userId: string) {
    if (!ws) return;
    if (!confirm("確定要移除此成員？")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "移除失敗");
        return;
      }
      toast.success("已移除成員");
      await load();
      await refreshWs();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !ws) {
    return <div className="mx-auto max-w-4xl py-10 text-sm text-ink-secondary">載入中…</div>;
  }

  const canManage = ws.role === "owner" || ws.role === "admin";
  const isOwner = ws.role === "owner";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">成員</p>
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">成員管理</h1>
          <p className="text-[15px] leading-relaxed text-ink-secondary">
            邀請以 Email 為準；對方需以相同信箱註冊／登入後開啟邀請連結。
            <Link href="/team" className="ml-2 font-medium text-ink underline-offset-4 hover:underline">
              返回工作區總覽
            </Link>
          </p>
        </div>
        <Badge tone={isOwner ? "emerald" : canManage ? "blue" : "neutral"}>
          {ws.role === "owner" ? "擁有者" : ws.role === "admin" ? "管理員" : "成員"}
        </Badge>
      </div>

      {!canManage ? (
        <Card className="border-surface-border bg-canvas">
          <CardContent className="py-4 text-sm text-ink-secondary">
            你為<span className="font-semibold text-ink">成員</span>
            ：可檢視成員與用量；無法發送邀請或移除他人。
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>邀請成員</CardTitle>
            <CardDescription>
              {ws.role === "admin"
                ? "管理員可邀請成員；無法邀請或移除其他管理員（需擁有者）。"
                : "擁有者可邀請管理員或成員，並管理成員與額度。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-xs font-medium text-ink-secondary">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="w-full space-y-2 sm:w-40">
                <label className="text-xs font-medium text-ink-secondary">角色</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="h-11 w-full rounded-xl border border-surface-border bg-white px-3 text-sm"
                  disabled={!isOwner && inviteRole === "admin"}
                >
                  <option value="member">成員</option>
                  {isOwner ? <option value="admin">管理員</option> : null}
                </select>
              </div>
              <Button
                type="button"
                className="h-11 rounded-xl"
                disabled={busy || !inviteEmail.trim()}
                onClick={() => void invite()}
              >
                建立邀請
              </Button>
            </div>

            {inviteDone ? (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-4 py-4 text-sm">
                <p className="font-semibold text-emerald-950">邀請已建立</p>
                <p className="mt-1 text-emerald-900/90">
                  已發送給 <span className="font-medium">{inviteDone.email}</span>
                  的邀請連結{inviteDone.url ? "（已嘗試複製到剪貼簿）" : ""}。
                </p>
                {inviteDone.url ? (
                  <div className="mt-3 space-y-2">
                    <div className="break-all rounded-lg bg-white/90 px-3 py-2 font-mono text-xs text-ink shadow-inner">
                      {inviteDone.url}
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void copyAgain()}>
                      複製連結
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>成員列表</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs uppercase text-ink-secondary">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">角色</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-surface-border/80">
                  <td className="py-3 font-medium text-ink">{m.email}</td>
                  <td className="py-3 text-ink-secondary">
                    {m.role === "owner" ? "擁有者" : m.role === "admin" ? "管理員" : "成員"}
                  </td>
                  <td className="py-3 text-right">
                    {canRemoveTarget(m) ? (
                      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void remove(m.userId)}>
                        移除
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用量紀錄</CardTitle>
          <CardDescription>依事件列出：成員、輸入類型、扣點（審查額度）。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs uppercase text-ink-secondary">
                <th className="py-2 pr-4">時間</th>
                <th className="py-2 pr-4">成員</th>
                <th className="py-2 pr-4">類型</th>
                <th className="py-2">扣點</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-ink-secondary">
                    尚無紀錄
                  </td>
                </tr>
              ) : (
                usage.map((u) => (
                  <tr key={u.id} className="border-b border-surface-border/80">
                    <td className="py-2 pr-4 text-ink-secondary">
                      {new Date(u.createdAt).toLocaleString("zh-TW")}
                    </td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.inputType}</td>
                    <td className="py-2">{u.unitsCharged}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
