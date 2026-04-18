import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BillingStatusResponse, UserBillingSnapshot } from "@/lib/billing/types";
import { getRecurringBillingPort } from "@/lib/billing/recurring-billing-factory";
import { getPrimaryWorkspaceForUser } from "@/lib/workspace/primary-workspace";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const ws = await getPrimaryWorkspaceForUser(supabase, user.id);
  const snapshot: UserBillingSnapshot | null = ws
    ? {
        plan: ws.plan,
        subscription_status: ws.subscription_status,
        billing_provider: ws.billing_provider,
        cancel_at_period_end: ws.cancel_at_period_end,
        current_period_end: ws.current_period_end,
      }
    : null;

  const port = getRecurringBillingPort();
  const status = await port.getSubscriptionStatus({
    userId: user.id,
    localSnapshot: snapshot,
  });

  const body: BillingStatusResponse = {
    ...status,
    workspaceId: ws?.id ?? null,
    workspaceName: ws?.name ?? null,
  };
  return NextResponse.json(body);
}
