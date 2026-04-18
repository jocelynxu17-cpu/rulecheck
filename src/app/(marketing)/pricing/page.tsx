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
    desc: "適合品牌、工作室試用與教育訓練。",
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
    <div className="px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="blue">Pricing</Badge>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-ink sm:text-4xl">簡單透明的方案</h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-ink-secondary sm:text-base">
          以訂閱制解鎖更高配額與多帳號共用。台灣在地金流與週期帳務即將開放，上線後即可於帳務頁完成升級與管理。
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3">
        {tiers.map((t) => (
          <Card
            key={t.name}
            className={`relative overflow-hidden p-0 ${
              t.highlight ? "border-surface-border ring-1 ring-black/[0.06]" : "border-surface-border bg-white"
            }`}
          >
            {t.highlight ? (
              <div className="absolute right-4 top-4">
                <Badge tone="blue">Popular</Badge>
              </div>
            ) : null}
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-medium">{t.name}</CardTitle>
              <CardDescription>{t.desc}</CardDescription>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-medium tracking-tight text-ink">{t.price}</span>
                {t.period ? <span className="text-sm text-ink-secondary">{t.period}</span> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
              <ul className="space-y-3 text-sm text-ink-secondary">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.cta.external ? (
                <a
                  href={t.cta.href}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-surface-border bg-white text-sm font-medium text-ink transition hover:bg-zinc-50"
                >
                  {t.cta.label}
                </a>
              ) : (
                <Link
                  href={t.cta.href}
                  className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition ${
                    t.highlight
                      ? "bg-brand-strong text-white hover:bg-brand-strong/90"
                      : "border border-surface-border bg-white text-ink hover:bg-zinc-50"
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
