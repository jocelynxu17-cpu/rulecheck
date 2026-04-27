import { createAdminClient } from "@/lib/supabase/admin";

export type InternalUserWorkspaceMembership = {
  workspace_id: string;
  workspace_name: string;
  role: string;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

export type InternalUserPaymentEventRow = {
  id: string;
  provider: string;
  event_type: string;
  created_at: string;
  subscription_id: string | null;
};

export type InternalUserAuthSummary = {
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  phone: string | null;
  providers: string[];
};

export type InternalUserProfileRow = {
  id: string;
  email: string | null;
  created_at: string;
  plan: string | null;
  subscription_status: string | null;
  monthly_analysis_quota: number;
  analyses_used_month: number;
  usage_month: string;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type InternalUserDetail = {
  profile: InternalUserProfileRow | null;
  auth: InternalUserAuthSummary | null;
  auth_error: string | null;
  memberships: InternalUserWorkspaceMembership[];
  memberships_error: string | null;
  payment_events: InternalUserPaymentEventRow[];
  subscriptions: Array<{
    id: string;
    provider: string;
    status: string;
    plan: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
    created_at: string;
  }>;
  error: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fetchInternalUserDetail(userId: string): Promise<InternalUserDetail> {
  const empty: InternalUserDetail = {
    profile: null,
    auth: null,
    auth_error: null,
    memberships: [],
    memberships_error: null,
    payment_events: [],
    subscriptions: [],
    error: null,
  };

  if (!UUID_RE.test(userId)) {
    return { ...empty, error: "使用者 ID 格式不正確。" };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: "未設定 SUPABASE_SERVICE_ROLE_KEY。" };
  }

  try {
    const admin = createAdminClient();

    const [{ data: profile, error: pErr }, membershipsRes, payRes, subRes, authRes] = await Promise.all([
      admin
        .from("users")
        .select(
          "id, email, created_at, plan, subscription_status, monthly_analysis_quota, analyses_used_month, usage_month, billing_provider, cancel_at_period_end, current_period_end, stripe_customer_id, stripe_subscription_id"
        )
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("workspace_members")
        .select(
          "workspace_id, role, workspaces(id, name, plan, subscription_status, billing_provider, cancel_at_period_end, current_period_end)"
        )
        .eq("user_id", userId),
      admin
        .from("payment_events")
        .select("id, provider, event_type, created_at, subscription_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("subscriptions")
        .select("id, provider, status, plan, cancel_at_period_end, current_period_end, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.auth.admin.getUserById(userId),
    ]);

    if (pErr) {
      return { ...empty, error: pErr.message };
    }

    const memberships: InternalUserWorkspaceMembership[] = [];
    for (const raw of membershipsRes.data ?? []) {
      const r = raw as unknown as {
        workspace_id: string;
        role: string;
        workspaces:
          | {
              id: string;
              name: string;
              plan: string | null;
              subscription_status: string | null;
              billing_provider: string | null;
              cancel_at_period_end: boolean | null;
              current_period_end: string | null;
            }
          | {
              id: string;
              name: string;
              plan: string | null;
              subscription_status: string | null;
              billing_provider: string | null;
              cancel_at_period_end: boolean | null;
              current_period_end: string | null;
            }[]
          | null;
      };
      let w = r.workspaces;
      if (Array.isArray(w)) {
        w = w[0] ?? null;
      }
      if (!w) continue;
      memberships.push({
        workspace_id: w.id,
        workspace_name: w.name,
        role: r.role,
        plan: w.plan,
        subscription_status: w.subscription_status,
        billing_provider: w.billing_provider,
        cancel_at_period_end: w.cancel_at_period_end,
        current_period_end: w.current_period_end,
      });
    }

    let auth: InternalUserAuthSummary | null = null;
    let auth_error: string | null = null;
    if (authRes.error) {
      auth_error = authRes.error.message;
    } else if (authRes.data?.user) {
      const u = authRes.data.user;
      const identities = u.identities ?? [];
      const providers = [...new Set(identities.map((i) => i.provider).filter(Boolean))] as string[];
      auth = {
        email_confirmed_at: u.email_confirmed_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: u.banned_until ?? null,
        phone: u.phone ?? null,
        providers,
      };
    }

    const payment_events = (payRes.data ?? []) as InternalUserPaymentEventRow[];
    const subscriptions = (subRes.data ?? []) as InternalUserDetail["subscriptions"];

    if (!profile) {
      return {
        ...empty,
        auth,
        auth_error,
        memberships,
        memberships_error: membershipsRes.error?.message ?? null,
        payment_events,
        subscriptions,
        error: auth ? null : "找不到此使用者（資料庫無對應列）。",
      };
    }

    return {
      profile: profile as InternalUserProfileRow,
      auth,
      auth_error,
      memberships,
      memberships_error: membershipsRes.error?.message ?? null,
      payment_events,
      subscriptions,
      error: null,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "載入失敗",
    };
  }
}
