"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  billingProviderLabelZh,
  subscriptionStatusLabelZh,
} from "@/lib/billing/subscription-state";

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  monthly_quota_units: number;
  units_used_month: number;
  usage_month: string;
  created_at: string;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  plan: string | null;
  subscription_status: string | null;
  monthly_analysis_quota: number;
  analyses_used_month: number;
  usage_month: string;
  created_at: string;
};

function formatPeriodEndTaipeiShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function AdminPanel({
  workspaces,
  users,
  listError,
  usersError,
  yymm,
  showWorkspaces = true,
  showUsers = true,
  showManualAdjust = true,
}: {
  workspaces: AdminWorkspaceRow[];
  users: AdminUserRow[];
  listError: string | null;
  usersError: string | null;
  yymm: string;
  showWorkspaces?: boolean;
  showUsers?: boolean;
  showManualAdjust?: boolean;
}) {
  const [q, setQ] = useState("");

  const searchDescription =
    showWorkspaces && showUsers
      ? "依工作區名稱、使用者 Email 或 UUID 篩選下列兩張表。"
      : showWorkspaces
        ? "依工作區名稱或 UUID 篩選。"
        : "依使用者 Email 或 UUID 篩選。";

  const filteredWs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(s) || w.id.toLowerCase().includes(s));
  }, [workspaces, q]);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(s) || u.id.toLowerCase().includes(s));
  }, [users, q]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>搜尋</CardTitle>
          <CardDescription>{searchDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="輸入關鍵字…"
            className="max-w-md"
            aria-label="搜尋工作區與使用者"
          />
        </CardContent>
      </Card>

      {showWorkspaces ? (
      <Card>
        <CardHeader>
          <CardTitle>工作區（多帳號共用審查額度）</CardTitle>
          <CardDescription>
            <span className="font-medium text-ink">帳務欄位以工作區為唯一來源（SSOT）</span>
            ：方案、訂閱狀態、帳務來源、週期結束、額度與用量。下列「使用者」表為個人列備查。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listError ? (
            <p className="text-sm text-amber-900">{listError}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">工作區</th>
                    <th className="px-4 py-3">方案</th>
                    <th className="px-4 py-3">訂閱狀態</th>
                    <th className="px-4 py-3">帳務來源</th>
                    <th className="px-4 py-3">目前週期結束</th>
                    <th className="px-4 py-3">週期末取消</th>
                    <th className="px-4 py-3">共用審查額度</th>
                    <th className="px-4 py-3">本月已用</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWs.map((w) => {
                    const used = w.usage_month === yymm ? w.units_used_month : 0;
                    return (
                      <tr key={w.id} className="border-b border-surface-border/80 last:border-0">
                        <td className="max-w-[200px] truncate px-4 py-3 font-medium text-ink">
                          <Link
                            href={`/internal/workspaces/${w.id}`}
                            className="text-ink underline-offset-4 hover:underline"
                          >
                            {w.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{w.plan ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{subscriptionStatusLabelZh(w.subscription_status)}</td>
                        <td className="px-4 py-3 text-ink-secondary">{billingProviderLabelZh(w.billing_provider) ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-secondary">
                          {formatPeriodEndTaipeiShort(w.current_period_end)}
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{w.cancel_at_period_end ? "是" : "否"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{w.monthly_quota_units}</td>
                        <td className="px-4 py-3 text-ink-secondary">{used}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {showUsers ? (
      <Card>
        <CardHeader>
          <CardTitle>使用者</CardTitle>
          <CardDescription>個人帳號層級的方案欄位（與工作區帳務並存，便於對帳）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersError ? (
            <p className="text-sm text-amber-900">{usersError}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-canvas text-xs font-medium uppercase tracking-wide text-ink-secondary">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">方案</th>
                    <th className="px-4 py-3">訂閱狀態</th>
                    <th className="px-4 py-3">個人額度欄位</th>
                    <th className="px-4 py-3">本月已用</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const used = u.usage_month === yymm ? u.analyses_used_month : 0;
                    return (
                      <tr key={u.id} className="border-b border-surface-border/80 last:border-0">
                        <td className="max-w-[240px] truncate px-4 py-3 font-medium text-ink">{u.email ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{u.plan ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{subscriptionStatusLabelZh(u.subscription_status)}</td>
                        <td className="px-4 py-3 text-ink-secondary">{u.monthly_analysis_quota}</td>
                        <td className="px-4 py-3 text-ink-secondary">{used}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {showManualAdjust ? (
      <Card>
        <CardHeader>
          <CardTitle>手動調整（預留）</CardTitle>
          <CardDescription>
            NewebPay 與營運流程就緒後，可於此調整方案與共用審查額度；目前僅為介面預留。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-secondary">方案（示意）</label>
            <Input disabled className="bg-canvas" placeholder="free / pro" readOnly />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-secondary">共用審查額度（點數）</label>
            <Input disabled className="bg-canvas" placeholder="—" readOnly />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled>
              儲存變更（金流上線後開放）
            </Button>
          </div>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
