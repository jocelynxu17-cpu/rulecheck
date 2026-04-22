/**
 * 本機驗證 POST /api/billing/notify（需 Cookie + 可選 QA_WORKSPACE_ID 測 v1）。
 *
 * Windows PowerShell 範例：
 *   $env:BILLING_NOTIFY_COOKIE="sb-xxx-auth-token=...."
 *   $env:NEXT_PUBLIC_SITE_URL="http://localhost:3000"
 *   $env:QA_WORKSPACE_ID="00000000-0000-0000-0000-000000000000"
 *   npm run qa:billing-notify
 */

const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const cookie = process.env.BILLING_NOTIFY_COOKIE || "";
const workspaceId = process.env.QA_WORKSPACE_ID || "";

async function post(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  if (!cookie) {
    console.error("請設定 BILLING_NOTIFY_COOKIE（已登入之 Cookie 字串）。");
    process.exit(1);
  }

  console.log("--- legacy: pro_interest ---");
  console.log(await post("/api/billing/notify", { kind: "pro_interest" }));

  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    console.log("--- billing v1 (workspace) ---");
    console.log(
      await post("/api/billing/notify", {
        version: 1,
        idempotency_key: `qa:script:${Date.now()}`,
        provider: "app",
        event_type: "qa.script_ping",
        workspace_id: workspaceId,
        billing_state: {
          subscription_status: "active",
          billing_provider: "app",
        },
        metadata: { source: "billing-notify-local.mjs" },
      })
    );
  } else {
    console.log("（略過 v1：未設定有效 QA_WORKSPACE_ID）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
