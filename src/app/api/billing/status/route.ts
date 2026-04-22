import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BillingStatusResponse, UserBillingSnapshot } from "@/lib/billing/types";
import { getRecurringBillingPort } from "@/lib/billing/recurring-billing-factory";
import {
  getPrimaryWorkspaceBillingUiSnapshot,
  workspaceBillingUiToUserSnapshot,
} from "@/lib/workspace/workspace-billing-snapshot";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const billingUi = await getPrimaryWorkspaceBillingUiSnapshot(supabase, user.id);
  const snapshot: UserBillingSnapshot | null = billingUi ? workspaceBillingUiToUserSnapshot(billingUi) : null;

  const port = getRecurringBillingPort();
  const status = await port.getSubscriptionStatus({
    userId: user.id,
    localSnapshot: snapshot,
  });

  const body: BillingStatusResponse = {
    ...status,
    workspaceId: billingUi?.workspaceId ?? null,
    workspaceName: billingUi?.workspaceName ?? null,
  };
  return NextResponse.json(body);
}
