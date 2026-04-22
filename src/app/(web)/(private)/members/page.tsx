"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { TeamMembersWorkspaceUrlSync } from "@/components/team/TeamMembersWorkspaceUrlSync";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type MemberRow = {
  userId: string;
  role: string;
  email: string;
  createdAt: string;
  joinedAt: string;
  status: string;
  monthlyUsedUnits: number;
  lastActivityAt: string | null;
};

type UsageRow = {
  id: string;
  userId: string;
  email: string;
  inputType: string;
  unitsCharged: number;
  createdAt: string;
};

type InviteListItem = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByEmail: string;
  status: string;
  statusLabel: string;
  statusTone: "blue" | "amber" | "emerald" | "neutral";
  inviteUrl: string | null;
};

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function roleLabelZh(role: string) {
  if (role === "owner") return "擁有者";
  if (role === "admin") return "管理員";
  return "成員";
}

function roleHintZh(role: string) {
  if (role === "owner") return "完整權限與帳務對應";
  if (role === "admin") return "邀請／移除成員（依規則）";
  return "使用共用審查額度與紀錄";
}

export default function TeamMembersPage() {
  const { workspaces, selectedId, loading, refresh: refreshWs, viewerUserId } = useWorkspace();
  const ws = workspaces.find((w) => w.id === selectedId) ?? workspaces[0];
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<InviteListItem[]>([]);
  const [historyInvites, setHistoryInvites] = useState<InviteListItem[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [inviteDone, setInviteDone] = useState<{ email: string; url: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [revokeInviteTarget, setRevokeInviteTarget] = useState<InviteListItem | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<MemberRow | null>(null);
  const [roleDraft, setRoleDraft] = useState<"admin" | "member">("member");

  const ownerCount = members.filter((m) => m.role === "owner").length;

  const load = useCallback(async () => {
    if (!ws) return;
    const [mRes, uRes, iRes] = await Promise.all([
      fetch(`/api/workspaces/${ws.id}/members`, { credentials: "same-origin" }),
      fetch(`/api/workspaces/${ws.id}/usage`, { credentials: "same-origin" }),
      fetch(`/api/workspaces/${ws.id}/invites`, { credentials: "same-origin" }),
    ]);
    const mJson = (await mRes.json()) as { members?: MemberRow[] };
    const uJson = (await uRes.json()) as { events?: UsageRow[] };
    const iJson = (await iRes.json()) as { pending?: InviteListItem[]; history?: InviteListItem[] };
    if (mRes.ok) setMembers(mJson.members ?? []);
    if (uRes.ok) setUsage(uJson.events ?? []);
    if (iRes.ok) {
      setPendingInvites(iJson.pending ?? []);
      setHistoryInvites(iJson.history ?? []);
    }
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  function canRemoveTarget(target: MemberRow): boolean {
    if (!ws) return false;
    if (!(ws.role === "owner" || ws.role === "admin")) return false;
    if (target.role === "owner") {
      if (ws.role !== "owner") return false;
      if (ownerCount <= 1) return false;
      return true;
    }
    if (ws.role === "admin") return target.role === "member";
    return true;
  }

  function canChangeRole(target: MemberRow): boolean {
    if (!ws || ws.role !== "owner") return false;
    return target.role === "admin" || target.role === "member";
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
      const data = (await res.json()) as { inviteUrl?: string; error?: string };
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
        description: url
          ? "邀請連結已嘗試複製到剪貼簿；對方加入後與你共用此工作區之審查額度。"
          : "請將下方連結傳給對方；對方需以相同信箱註冊／登入後開啟。",
        duration: 6500,
      });
      setInviteEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite(inviteId: string) {
    if (!ws) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/invites/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "resend" }),
      });
      const data = (await res.json()) as { inviteUrl?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法重新寄送");
        return;
      }
      if (data.inviteUrl) {
        try {
          await navigator.clipboard.writeText(data.inviteUrl);
        } catch {
          /* ignore */
        }
      }
      toast.success("已更新邀請連結", {
        description: data.inviteUrl ? "新連結已嘗試複製到剪貼簿，舊連結將失效。" : "請於列表中複製新連結。",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevokeInvite() {
    if (!ws || !revokeInviteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/invites/${revokeInviteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法撤銷");
        return;
      }
      toast.success("已撤銷邀請", { description: "該連結已失效。" });
      setRevokeInviteTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("邀請連結已複製");
    } catch {
      toast.error("無法複製，請手動選取連結");
    }
  }

  async function copyAgain() {
    if (!inviteDone?.url) return;
    await copyInviteUrl(inviteDone.url);
  }

  async function confirmRemove() {
    if (!ws || !removeTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members/${removeTarget.userId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "移除失敗");
        return;
      }
      toast.success("已移除成員", {
        description: "對方將無法再使用此工作區之共用審查額度。",
      });
      setRemoveTarget(null);
      await load();
      await refreshWs();
    } finally {
      setBusy(false);
    }
  }

  async function saveRoleChange() {
    if (!ws || !roleEditTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members/${roleEditTarget.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ role: roleDraft }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "更新失敗");
        return;
      }
      toast.success("已更新角色");
      setRoleEditTarget(null);
      await load();
      await refreshWs();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl py-10 text-sm text-ink-secondary">載入中…</div>;
  }

  if (!ws) {
    return (
      <div className="mx-auto max-w-4xl py-8 text-sm text-ink-secondary">
        尚未載入工作區，無法管理成員。請先使用頁面上方的「修復並同步工作區」。
      </div>
    );
  }

  const canManage = ws.role === "owner" || ws.role === "admin";
  const isOwner = ws.role === "owner";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <TeamMembersWorkspaceUrlSync />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">成員</p>
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">成員管理</h1>
          <p className="text-[15px] leading-relaxed text-ink-secondary">
            邀請以 Email 為準；對方需以相同信箱註冊／登入後開啟邀請連結。擁有者與管理員權限依產品規則區分。
            <Link href="/analyze" className="ml-2 font-medium text-ink underline-offset-4 hover:underline">
              返回檢測
            </Link>
          </p>
        </div>
        <div className="text-right">
          <Badge tone={isOwner ? "emerald" : canManage ? "blue" : "neutral"}>{roleLabelZh(ws.role)}</Badge>
          <p className="mt-1 text-xs text-ink-secondary">{roleHintZh(ws.role)}</p>
        </div>
      </div>

      {!canManage ? (
        <Card className="border-surface-border bg-canvas">
          <CardContent className="py-4 text-sm text-ink-secondary">
            你為<span className="font-semibold text-ink">成員</span>
            ：可檢視成員、邀請紀錄與用量；無法發送邀請或變更他人角色。
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>邀請成員</CardTitle>
            <CardDescription>
              {ws.role === "admin"
                ? "管理員可邀請一般成員、重新寄送或撤銷邀請；無法邀請其他管理員或移除管理員／擁有者。"
                : "擁有者可邀請管理員或成員、調整角色與移除成員（受最後擁有者規則保護）。"}
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
                <p className="font-semibold text-emerald-950">邀請成功</p>
                <p className="mt-1 text-emerald-900/90">
                  目標信箱：<span className="font-medium">{inviteDone.email}</span>
                  {inviteDone.url ? " · 系統已嘗試將邀請連結複製到剪貼簿。" : " · 請複製下方連結給對方。"}
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

      {pendingInvites.length > 0 || canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">待處理邀請</CardTitle>
            <CardDescription>
              {canManage
                ? "狀態為「待加入」或「已過期」之邀請；可重新寄送、複製連結或撤銷。"
                : "僅供檢視；建立與撤銷需擁有者或管理員。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pendingInvites.length === 0 ? (
              <p className="text-sm text-ink-secondary">{canManage ? "目前無待處理邀請。" : "尚無待處理邀請。"}</p>
            ) : (
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase text-ink-secondary">
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">角色</th>
                    <th className="py-2 pr-4">狀態</th>
                    <th className="py-2 pr-4">建立</th>
                    <th className="py-2 pr-4">到期</th>
                    <th className="py-2 pr-4">邀請人</th>
                    {canManage ? <th className="py-2 text-right">操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((inv) => (
                    <tr key={inv.id} className="border-b border-surface-border/80">
                      <td className="py-3 font-medium text-ink">{inv.email}</td>
                      <td className="py-3 text-ink-secondary">{inv.role === "admin" ? "管理員" : "成員"}</td>
                      <td className="py-3">
                        <Badge tone={inv.statusTone}>{inv.statusLabel}</Badge>
                      </td>
                      <td className="py-3 text-ink-secondary">{formatShortDate(inv.createdAt)}</td>
                      <td className="py-3 text-ink-secondary">{formatShortDate(inv.expiresAt)}</td>
                      <td className="py-3 text-ink-secondary">{inv.invitedByEmail}</td>
                      {canManage ? (
                        <td className="py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {inv.inviteUrl ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void copyInviteUrl(inv.inviteUrl!)}
                              >
                                複製連結
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => void resendInvite(inv.id)}
                            >
                              重新寄送
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => setRevokeInviteTarget(inv)}
                            >
                              撤銷
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {historyInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">邀請紀錄</CardTitle>
            <CardDescription>已加入或已撤銷之邀請（全成員可檢視）。</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs uppercase text-ink-secondary">
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">角色</th>
                  <th className="py-2 pr-4">狀態</th>
                  <th className="py-2 pr-4">建立</th>
                  <th className="py-2 pr-4">到期</th>
                  <th className="py-2 pr-4">邀請人</th>
                </tr>
              </thead>
              <tbody>
                {historyInvites.map((inv) => (
                  <tr key={inv.id} className="border-b border-surface-border/80">
                    <td className="py-3 font-medium text-ink">{inv.email}</td>
                    <td className="py-3 text-ink-secondary">{inv.role === "admin" ? "管理員" : "成員"}</td>
                    <td className="py-3">
                      <Badge tone={inv.statusTone}>{inv.statusLabel}</Badge>
                    </td>
                    <td className="py-3 text-ink-secondary">{formatShortDate(inv.createdAt)}</td>
                    <td className="py-3 text-ink-secondary">{formatShortDate(inv.expiresAt)}</td>
                    <td className="py-3 text-ink-secondary">{inv.invitedByEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>成員列表</CardTitle>
          <CardDescription>
            顯示目前工作區成員、加入時間、本月用量與最近活動。擁有者可調整管理員／成員角色。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs uppercase text-ink-secondary">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">角色</th>
                <th className="py-2 pr-4">狀態</th>
                <th className="py-2 pr-4">加入時間</th>
                <th className="py-2 pr-4">最近活動</th>
                <th className="py-2 pr-4">本月用量（點）</th>
                <th className="py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-surface-border/80">
                  <td className="py-3 font-medium text-ink">
                    {m.email}
                    {viewerUserId && m.userId === viewerUserId ? (
                      <span className="ml-2 text-xs font-normal text-ink-secondary">（你）</span>
                    ) : null}
                  </td>
                  <td className="py-3 text-ink-secondary">
                    <span className="font-medium text-ink">{roleLabelZh(m.role)}</span>
                    <span className="mt-0.5 block text-xs text-ink-secondary/90">{roleHintZh(m.role)}</span>
                  </td>
                  <td className="py-3">
                    <Badge tone="emerald">使用中</Badge>
                  </td>
                  <td className="py-3 text-ink-secondary">{formatShortDate(m.joinedAt)}</td>
                  <td className="py-3 text-ink-secondary">{formatShortDate(m.lastActivityAt)}</td>
                  <td className="py-3 tabular-nums text-ink-secondary">{m.monthlyUsedUnits}</td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canChangeRole(m) ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setRoleDraft(m.role === "admin" ? "admin" : "member");
                            setRoleEditTarget(m);
                          }}
                        >
                          變更角色
                        </Button>
                      ) : null}
                      {canRemoveTarget(m) ? (
                        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setRemoveTarget(m)}>
                          移除
                        </Button>
                      ) : null}
                    </div>
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
          <CardDescription>依事件列出：成員、輸入類型、扣點（共用審查額度）。</CardDescription>
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
                    <td className="py-2 pr-4 text-ink-secondary">{new Date(u.createdAt).toLocaleString("zh-TW")}</td>
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

      {removeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <Card className="max-h-[90vh] w-full max-w-md overflow-auto shadow-none">
            <CardHeader>
              <CardTitle>確認移除成員？</CardTitle>
              <CardDescription>
                將移除 <span className="font-medium text-ink">{removeTarget.email}</span>{" "}
                對此工作區的存取；對方無法再使用此多帳號共用審查額度與紀錄。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setRemoveTarget(null)}>
                取消
              </Button>
              <Button type="button" disabled={busy} onClick={() => void confirmRemove()}>
                {busy ? "處理中…" : "確認移除"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {revokeInviteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <Card className="max-h-[90vh] w-full max-w-md overflow-auto shadow-none">
            <CardHeader>
              <CardTitle>確認撤銷邀請？</CardTitle>
              <CardDescription>
                將撤銷寄給 <span className="font-medium text-ink">{revokeInviteTarget.email}</span>{" "}
                的邀請連結；對方將無法再以此連結加入。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setRevokeInviteTarget(null)}>
                取消
              </Button>
              <Button type="button" disabled={busy} onClick={() => void confirmRevokeInvite()}>
                {busy ? "處理中…" : "確認撤銷"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {roleEditTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <Card className="max-h-[90vh] w-full max-w-md overflow-auto shadow-none">
            <CardHeader>
              <CardTitle>變更角色</CardTitle>
              <CardDescription>
                成員：<span className="font-medium text-ink">{roleEditTarget.email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink-secondary">新角色</label>
                <select
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value as "admin" | "member")}
                  className="h-11 w-full rounded-xl border border-surface-border bg-white px-3 text-sm"
                >
                  <option value="member">成員</option>
                  <option value="admin">管理員</option>
                </select>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setRoleEditTarget(null)}>
                  取消
                </Button>
                <Button type="button" disabled={busy} onClick={() => void saveRoleChange()}>
                  {busy ? "處理中…" : "儲存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
