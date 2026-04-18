import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { BillingCancelResponse } from "@/lib/billing/types";
import { getRecurringBillingPort } from "@/lib/billing/recurring-billing-factory";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const port = getRecurringBillingPort();
  const result = await port.cancelSubscription({ userId: user.id });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const body: BillingCancelResponse = {
    ok: true,
    mode: result.mode,
    message: result.message,
  };
  return NextResponse.json(body);
}
