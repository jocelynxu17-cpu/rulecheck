import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Tier = {
  name: string;
  price: string;
  period?: string;
  desc: string;
  features: string[];
  cta: { href: string; label: string; external?: boolean };
  highlight: boolean;
};

const tiers: Tier[] = [
  {
    name: "Free",
    price: "NT$0",
    desc: "適合新創團隊試用與教育訓練。",
    features: ["每月 30 次檢測", "紀錄留存 90 天（示意）", "Email 支援"],
    cta: { href: "/signup", label: "開始使用" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "NT$990",
    period: "/ 月",
    desc: "給需要大量產出與跨部門協作的成長型品牌。",
    features: ["每月 2,000 次檢測", "優先佇列（示意）", "匯出與 API（即將推出）"],
    cta: { href: "/billing", label: "升級方案" },
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "與我們聯絡",
    desc: "客製詞庫、專屬模型微調、SLA 與導入顧問。",
    features: ["專屬成功經理", "法遵顧問對接（示意）", "VPC / 單租戶選項"],
    cta: { href: "mailto:hello@rulecheck.app", label: "聯絡銷售", external: true },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="blue">Pricing</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">簡單透明的方案</h1>
        <p className="mt-4 text-pretty text-lg text-ink-secondary">
          以訂閱制解鎖更高配額與團隊協作能力。Stripe 結帳已預先串接，部署後填入 Price ID 即可啟用。
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <Card
            key={t.name}
            className={`relative overflow-hidden p-0 ${
              t.highlight ? "border-brand/40 shadow-soft ring-1 ring-brand/15" : "bg-white/90"
            }`}
          >
            {t.highlight ? (
              <div className="absolute right-4 top-4">
                <Badge tone="blue">Popular</Badge>
              </div>
            ) : null}
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl">{t.name}</CardTitle>
              <CardDescription>{t.desc}</CardDescription>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight text-ink">{t.price}</span>
                {t.period ? <span className="text-sm text-ink-secondary">{t.period}</span> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
              <ul className="space-y-3 text-sm text-ink-secondary">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-brand/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.cta.external ? (
                <a
                  href={t.cta.href}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-surface-border bg-white text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40"
                >
                  {t.cta.label}
                </a>
              ) : (
                <Link
                  href={t.cta.href}
                  className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition ${
                    t.highlight
                      ? "bg-gradient-to-br from-[#B8D9FF] via-brand to-brand-strong text-white shadow-soft hover:brightness-[1.03]"
                      : "border border-surface-border bg-white text-ink shadow-sm hover:border-brand/40"
                  }`}
                >
                  {t.cta.label}
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
