import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { BillingCheckoutResponse } from "@/lib/billing/types";
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
  const result = await port.createSubscription({
    userId: user.id,
    email: user.email ?? null,
    plan: "pro",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.mode === "redirect") {
    const body: BillingCheckoutResponse = {
      ok: true,
      mode: "redirect",
      message: result.message ?? "",
      checkoutUrl: result.checkoutUrl,
    };
    return NextResponse.json(body);
  }

  const body: BillingCheckoutResponse = {
    ok: true,
    mode: "placeholder",
    message: result.message,
    checkoutUrl: result.checkoutUrl,
  };
  return NextResponse.json(body);
}
