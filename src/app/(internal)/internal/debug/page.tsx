import Link from "next/link";
import { loadPaymentEvents } from "@/lib/admin/load-payment-events";
import {
  BillingNotifyTestForm,
  DebugOperatorToolboxSummary,
  PaymentEventJsonLookup,
  WorkspaceJsonLookup,
} from "@/components/internal-debug/InternalDebugTools";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

const quick = [
  { href: "/internal", label: "總覽" },
  { href: "/internal/workspaces", label: "工作區" },
  { href: "/internal/analysis", label: "分析營運" },
  { href: "/internal/payment-events", label: "帳務" },
  { href: "/internal/audit", label: "稽核" },
  { href: "/internal/security", label: "安全" },
  { href: "/internal/settings", label: "設定" },
];

export default async function InternalDebugPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const rawWs = firstString(sp.workspace);
  const rawEv = firstString(sp.event);
  const initialWorkspaceId = rawWs && UUID_RE.test(rawWs) ? rawWs : undefined;
  const initialEventId = rawEv && UUID_RE.test(rawEv) ? rawEv : undefined;

  const { rows: paymentSample, error: paymentSampleError } = await loadPaymentEvents(200);

  return (
    <div className="space-y-10 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">除錯工具</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
          技術用：工作區／帳務事件原始列、異常摘要、Notify 測試。日常營運請以總覽與各分頁為主。權限與{" "}
          <code className="rounded bg-canvas px-1 font-mono text-xs">/internal</code>{" "}
          相同（SUPERADMIN_EMAILS；未設定時為 ADMIN_EMAILS）；請勿外流查詢結果或金鑰。
        </p>
      </div>

      <section className="rounded-xl border border-surface-border bg-white/70 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-secondary">快速前往</p>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-none transition hover:border-ink/15 hover:bg-canvas/40"
            >
              {q.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-secondary">
          帳務列可點進本頁並帶入查詢：{" "}
          <code className="rounded bg-canvas px-1 font-mono text-[10px]">?event=UUID</code>、
          <code className="rounded bg-canvas px-1 font-mono text-[10px]">?workspace=UUID</code>
        </p>
      </section>

      {paymentSampleError ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
          無法載入帳務事件摘要：{paymentSampleError}
        </p>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-ink">摘要（最近 200 筆）</h2>
        <DebugOperatorToolboxSummary events={paymentSample} />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-ink">原始列查詢</h2>
        <WorkspaceJsonLookup initialWorkspaceId={initialWorkspaceId} />
        <PaymentEventJsonLookup initialEventId={initialEventId} />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-ink">帳務測試</h2>
        <BillingNotifyTestForm />
      </div>
    </div>
  );
}
