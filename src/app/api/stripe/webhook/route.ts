import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applySubscriptionDeletedToUser,
  applySubscriptionSyncToUser,
  buildUserPatchCheckoutFallback,
  resolveUserIdForInvoicePaid,
  resolveUserIdForSubscriptionSync,
  stripeSubscriptionIdFromExpandable,
} from "@/lib/stripe-subscription-sync";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook 未設定。" }, { status: 400 });
  }

  const body = await request.text();
  const hdrs = await headers();
  const sig = hdrs.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "缺少簽章" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? session.client_reference_id ?? null;
      const subscriptionId = stripeSubscriptionIdFromExpandable(session.subscription);

      if (session.mode === "subscription" && subscriptionId && userId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const resolved = await resolveUserIdForSubscriptionSync(admin, sub, { explicitUserId: userId });
          if (!resolved) {
            console.error("checkout.session.completed: could not resolve user", { userId, subscriptionId });
          } else {
            const sync = await applySubscriptionSyncToUser(admin, resolved, sub);
            if (!sync.ok) console.error("checkout.session.completed sync:", sync.error);
          }
        } catch (e) {
          console.error("checkout.session.completed subscription sync:", e);
          const customerId = typeof session.customer === "string" ? session.customer : null;
          const patch = buildUserPatchCheckoutFallback({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          });
          await admin.from("users").update(patch).eq("id", userId);
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscriptionSync(admin, sub);
      if (!userId) {
        return NextResponse.json({ received: true });
      }
      const sync = await applySubscriptionSyncToUser(admin, userId, sub);
      if (!sync.ok) console.error("subscription sync:", sync.error);
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeSubscriptionIdFromExpandable(invoice.subscription);

      if (!subscriptionId) {
        return NextResponse.json({ received: true });
      }

      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await resolveUserIdForInvoicePaid(admin, invoice, sub);
        if (!userId) {
          console.error("invoice.paid: could not resolve user", {
            subscriptionId,
            customer: invoice.customer,
          });
          return NextResponse.json({ received: true });
        }
        const sync = await applySubscriptionSyncToUser(admin, userId, sub);
        if (!sync.ok) console.error("invoice.paid sync:", sync.error);
      } catch (e) {
        console.error("invoice.paid subscription retrieve/sync:", e);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscriptionSync(admin, sub);
      await applySubscriptionDeletedToUser({ userId, stripeSubscriptionId: sub.id });
    }
  } catch (e) {
    console.error("stripe webhook handler:", e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
