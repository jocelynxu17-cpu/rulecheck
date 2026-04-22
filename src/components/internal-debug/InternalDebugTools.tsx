"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { paymentEventOutcomeTone } from "@/lib/admin/payment-event-ui";
import { summarizePaymentPayload } from "@/lib/admin/payment-payload-summary";
import { isLikelyPaymentFailureEventType, isNotifyLikePaymentEvent } from "@/lib/admin/payment-event-signals";
import type { AdminPaymentEventDetail } from "@/lib/admin/load-payment-events";
import { PaymentEventBadges, PaymentEventTypeBadge } from "@/components/admin/PaymentEventBadges";

const DEFAULT_NOTIFY = `{
  "version": 1,
  "idempotency_key": "debug:notify:test-1",
  "provider": "app",
  "event_type": "billing.debug_ping",
  "billing_state": {
    "plan": "free",
    "subscription_status": "active"
  }
}`;

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WorkspaceJsonLookup({ initialWorkspaceId }: { initialWorkspaceId?: string }) {
  const [id, setId] = useState(initialWorkspaceId ?? "");
  const [json, setJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialWorkspaceId) setId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  const fetchWorkspaceRow = useCallback(async (trimmed: string, silent?: boolean): Promise<boolean> => {
    setLoading(true);
    setJson(null);
    try {
      const res = await fetch(`/api/internal/debug/workspace?id=${encodeURIComponent(trimmed)}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as { ok?: boolean; row?: unknown; error?: string };
      if (!res.ok || body.ok === false) {
        if (!silent) toast.error("查詢失敗", { description: body.error ?? `HTTP ${res.status}` });
        return false;
      }
      setJson(JSON.stringify(body.row, null, 2));
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = initialWorkspaceId?.trim();
    if (!trimmed) return;
    void fetchWorkspaceRow(trimmed, true);
  }, [initialWorkspaceId, fetchWorkspaceRow]);

  async function run() {
    const trimmed = id.trim();
    if (!trimmed) {
      toast.error("請輸入工作區 UUID");
      return;
    }
    void fetchWorkspaceRow(trimmed, false);
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">工作區原始列（JSON）</CardTitle>
        <CardDescription>以 service role 讀取 `workspaces` 整列；僅內部營運門檻可呼叫 API。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-xs font-medium text-ink-secondary">工作區 ID（UUID）</label>
            <Input value={id} onChange={(e) => setId(e.target.value)} className="font-mono text-sm" placeholder="UUID" />
          </div>
          <Button type="button" variant="secondary" className="rounded-lg" disabled={loading} onClick={() => void run()}>
            {loading ? "查詢中…" : "查詢"}
          </Button>
        </div>
        {id.trim() ? (
          <p className="text-[11px] text-ink-secondary">
            <Link
              href={`/internal/workspaces/${encodeURIComponent(id.trim())}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              打開內部工作區詳情
            </Link>
          </p>
        ) : null}
        {json ? (
          <pre className="max-h-[min(70vh,520px)] overflow-auto rounded-xl border border-surface-border bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
            {json}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PaymentEventJsonLookup({ initialEventId }: { initialEventId?: string }) {
  const [id, setId] = useState(initialEventId ?? "");
  const [json, setJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEventId) setId(initialEventId);
  }, [initialEventId]);

  const fetchPaymentEventRow = useCallback(async (trimmed: string, silent?: boolean): Promise<boolean> => {
    setLoading(true);
    setJson(null);
    try {
      const res = await fetch(`/api/internal/debug/payment-event?id=${encodeURIComponent(trimmed)}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as { ok?: boolean; row?: unknown; error?: string };
      if (!res.ok || body.ok === false) {
        if (!silent) toast.error("查詢失敗", { description: body.error ?? `HTTP ${res.status}` });
        return false;
      }
      setJson(JSON.stringify(body.row, null, 2));
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = initialEventId?.trim();
    if (!trimmed) return;
    void fetchPaymentEventRow(trimmed, true);
  }, [initialEventId, fetchPaymentEventRow]);

  async function run() {
    const trimmed = id.trim();
    if (!trimmed) {
      toast.error("請輸入 payment_events.id");
      return;
    }
    void fetchPaymentEventRow(trimmed, false);
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">帳務事件原始列（JSON）</CardTitle>
        <CardDescription>讀取 `payment_events` 整列（含 payload）；與帳務事件／供應商紀錄頁同一資料源。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-xs font-medium text-ink-secondary">事件 ID（UUID）</label>
            <Input value={id} onChange={(e) => setId(e.target.value)} className="font-mono text-sm" placeholder="UUID" />
          </div>
          <Button type="button" variant="secondary" className="rounded-lg" disabled={loading} onClick={() => void run()}>
            {loading ? "查詢中…" : "查詢"}
          </Button>
        </div>
        {json ? (
          <pre className="max-h-[min(70vh,520px)] overflow-auto rounded-xl border border-surface-border bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
            {json}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BillingNotifyTestForm() {
  const [raw, setRaw] = useState(DEFAULT_NOTIFY);
  const [sending, setSending] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setLast(null);
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        toast.error("JSON 格式不正確");
        return;
      }
      const res = await fetch("/api/billing/notify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = { raw: text };
      }
      setLast(JSON.stringify(parsed, null, 2));
      if (!res.ok) {
        toast.error("Notify 回應錯誤", { description: String(parsed.error ?? res.status) });
        return;
      }
      toast.success("已送出", { description: String(parsed.message ?? "OK") });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">測試帳務 Notify</CardTitle>
        <CardDescription>
          POST 至 <code className="rounded bg-canvas px-1 font-mono text-xs">/api/billing/notify</code>
          ，使用<strong className="text-ink">目前登入者</strong>身分；請勿在正式環境送出危險 payload。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="min-h-[200px] w-full max-w-3xl rounded-xl border border-surface-border bg-white p-3 font-mono text-xs leading-relaxed text-ink"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
        />
        <Button type="button" className="rounded-lg" disabled={sending} onClick={() => void send()}>
          {sending ? "送出中…" : "送出 Notify"}
        </Button>
        {last ? (
          <div>
            <p className="mb-1 text-xs font-medium text-ink-secondary">回應</p>
            <pre className="max-h-[min(50vh,360px)] overflow-auto rounded-xl border border-surface-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
              {last}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function eventPayloadRecord(ev: AdminPaymentEventDetail): Record<string, unknown> | null {
  const p = ev.payload;
  return p && typeof p === "object" ? p : null;
}

/** 營運除錯主摘要：tone、供應商異常、帳務 notify 跡象（同一批 payment_events）。 */
export function DebugOperatorToolboxSummary({ events }: { events: AdminPaymentEventDetail[] }) {
  const red = events.filter((e) => paymentEventOutcomeTone(e.event_type) === "red").length;
  const amber = events.filter((e) => paymentEventOutcomeTone(e.event_type) === "amber").length;
  const toneFlagged = events.filter((ev) => {
    const tone = paymentEventOutcomeTone(ev.event_type);
    return tone === "red" || tone === "amber";
  });

  const providerFlagged = events.filter(
    (r) =>
      isLikelyPaymentFailureEventType(r.event_type) &&
      String(r.provider ?? "")
        .trim()
        .toLowerCase() !== "app"
  );

  const notifyFlagged = events.filter((r) =>
    isNotifyLikePaymentEvent({
      event_type: r.event_type,
      payload: eventPayloadRecord(r),
    })
  );

  const linkEvent = (id: string) => `/internal/debug?event=${encodeURIComponent(id)}`;

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-base">營運除錯摘要</CardTitle>
        <CardDescription>
          以下三區皆自同一批 <code className="rounded bg-canvas px-0.5 font-mono text-[11px]">payment_events</code>{" "}
          篩選（與供應商紀錄／帳務事件頁規則一致）；點列可帶入下方「事件 ID」查完整 JSON。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-surface-border/80 pb-2">
            <div>
              <h3 className="text-sm font-medium text-ink">失敗／留意（事件 tone）</h3>
              <p className="mt-1 text-xs text-ink-secondary">
                紅／琥珀筆數：{red}／{amber}；列最近 {Math.min(10, toneFlagged.length)} 筆。
              </p>
            </div>
            <Link
              href="/internal/provider-logs"
              className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
            >
              供應商紀錄
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-ink-secondary">尚無帳務事件。</p>
          ) : toneFlagged.length === 0 ? (
            <p className="text-sm text-ink-secondary">此批無紅／琥珀 tone 事件。</p>
          ) : (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white">
              {toneFlagged.slice(0, 10).map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={linkEvent(ev.id)}
                    className="block px-3 py-2.5 text-xs transition hover:bg-canvas/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                      <PaymentEventTypeBadge eventType={ev.event_type} />
                      <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-ink">{ev.id}</p>
                    <p className="mt-0.5 text-[11px] text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-surface-border/80 pb-2">
            <div>
              <h3 className="text-sm font-medium text-ink">供應商層級異常</h3>
              <p className="mt-1 text-xs text-ink-secondary">
                非 <code className="font-mono text-[10px]">app</code> provider 且事件類型含 failed／error 等關鍵字；此批共{" "}
                {providerFlagged.length} 筆，列最近 {Math.min(10, providerFlagged.length)} 筆。
              </p>
            </div>
            <Link
              href="/internal/provider-logs"
              className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
            >
              完整列表
            </Link>
          </div>
          {providerFlagged.length === 0 ? (
            <p className="text-sm text-ink-secondary">此批無符合之供應商異常事件。</p>
          ) : (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white">
              {providerFlagged.slice(0, 10).map((ev) => (
                <li key={ev.id}>
                  <Link href={linkEvent(ev.id)} className="block px-3 py-2.5 text-xs transition hover:bg-canvas/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                      <PaymentEventTypeBadge eventType={ev.event_type} />
                      <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-ink">{ev.id}</p>
                    <p className="mt-0.5 text-[11px] text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-surface-border/80 pb-2">
            <div>
              <h3 className="text-sm font-medium text-ink">帳務 Notify 跡象</h3>
              <p className="mt-1 text-xs text-ink-secondary">
                notify 前綴或 payload 含 <code className="font-mono text-[10px]">billing_state</code>；此批共{" "}
                {notifyFlagged.length} 筆，列最近 {Math.min(12, notifyFlagged.length)} 筆。
              </p>
            </div>
            <Link
              href="/internal/payment-events"
              className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
            >
              帳務事件
            </Link>
          </div>
          {notifyFlagged.length === 0 ? (
            <p className="text-sm text-ink-secondary">此批無 notify 類事件。</p>
          ) : (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white">
              {notifyFlagged.slice(0, 12).map((ev) => (
                <li key={ev.id}>
                  <Link href={linkEvent(ev.id)} className="block px-3 py-2.5 text-xs transition hover:bg-canvas/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentEventBadges provider={ev.provider} eventType={ev.event_type} compact />
                      <PaymentEventTypeBadge eventType={ev.event_type} />
                      <span className="text-[11px] text-ink-secondary">{formatDateTime(ev.created_at)}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-ink">{ev.id}</p>
                    <p className="mt-0.5 text-[11px] text-ink-secondary">{summarizePaymentPayload(ev.payload)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
