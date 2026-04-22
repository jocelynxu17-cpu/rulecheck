# Billing Notify QA（`/api/billing/notify`）

本文件協助驗證 **legacy 意願通知** 與 **billing_event v1** 寫入 `payment_events` 及工作區帳務 SSOT 的行為。

## 前置條件

- 本機已登入（瀏覽器有 Supabase session cookie）。
- 環境已設定 `SUPABASE_SERVICE_ROLE_KEY`（否則 API 會略過審計與工作區寫入，回傳 `mode: "skipped"`）。

## 方式一：瀏覽器 DevTools

1. 開啟已登入的站臺（例如 `http://localhost:3000/billing`）。
2. DevTools → **Application** → **Cookies**，複製專案對應的 `sb-*-auth-token`（或整組 Cookie 字串）。
3. **Console** 執行：

### Legacy（與「通知我開通」相同）

```javascript
await fetch("/api/billing/notify", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "pro_interest" }),
}).then((r) => r.json());
```

### Billing event v1（工作區 SSOT 寫回）

將 `WORKSPACE_ID` 換成擁有者工作區 UUID；`idempotency_key` 每次測試請改唯一值。

```javascript
await fetch("/api/billing/notify", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    version: 1,
    idempotency_key: "qa:test:" + Date.now(),
    provider: "app",
    event_type: "qa.subscription_updated",
    workspace_id: "WORKSPACE_ID",
    billing_state: {
      plan: "pro",
      subscription_status: "active",
      monthly_quota_units: 8000,
      cancel_at_period_end: false,
    },
    metadata: { source: "qa_console" },
  }),
}).then((r) => r.json());
```

預期：`ok: true`、`recorded` / `duplicate`、`workspaceUpdated` 與訊息符合邏輯；內部營運 **工作區** 表應反映帳務欄位。

## 方式二：本機腳本

需 Node 18+（內建 `fetch`）。

```bash
set BILLING_NOTIFY_COOKIE=sb-xxx-auth-token=...   # Windows CMD：完整 Cookie 或單一 token 視你的部署而定
set NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run qa:billing-notify
```

腳本會送出一筆 **legacy** 與一筆 **v1** 範例（v1 需腳本內設定 `QA_WORKSPACE_ID` 環境變數，否則僅送 legacy）。編輯 `scripts/billing-notify-local.mjs` 頂端註解可調整 body。

## 與檢測 API 一致性

`POST /api/analyze` 回傳之 `meta.plan`、`meta.workspaceMonthlyQuotaUnits` 等欄位皆來自**當次分析所屬工作區**（`workspaces`），與帳務頁／`consume_workspace_units` 扣點一致，不再讀 `users.plan`。

## 驗證清單

- [ ] Legacy 同日第二次：`duplicate: true`，訊息提示已記錄過。
- [ ] `pro_interest` 後，擁有者工作區 `billing_provider` 為 `app`（若 service role 啟用）。
- [ ] v1 同一 `idempotency_key` 重送：`duplicate: true`；帶 `billing_state` 時仍會再次套用工作區欄位。
- [ ] 非擁有者帶他人 `workspace_id`：HTTP 403。
