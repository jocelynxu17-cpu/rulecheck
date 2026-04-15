import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_PRO;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe 尚未完成設定（缺少金鑰或方案 Price ID）。" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/billing?checkout=success`,
    cancel_url: `${siteUrl}/billing?checkout=cancel`,
    metadata: { user_id: user.id },
    client_reference_id: user.id,
    subscription_data: {
      metadata: { user_id: user.id },
    },
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email }),
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "無法建立結帳連結。" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
