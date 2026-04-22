import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items: { label: string; href: string; hint: string }[] = [
  { label: "新使用者工作區", href: "/signup", hint: "註冊 → 儀表板有預設工作區" },
  { label: "儀表板／額度／修復", href: "/dashboard", hint: "額度摘要、修復橫幅" },
  { label: "帳務與 notify", href: "/billing", hint: "Pro 意圖、修復按鈕；詳見 docs/BILLING-NOTIFY-QA.md" },
  { label: "成員與邀請", href: "/members", hint: "邀請列表、重送、撤銷" },
  { label: "加入工作區", href: "/team/join", hint: "需有效 token" },
  { label: "檢測（扣點）", href: "/analyze", hint: "文字／圖／PDF" },
  { label: "分析紀錄", href: "/history", hint: "RLS 與清單" },
];

export function QaChecklistCard() {
  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle>QA 快速連結</CardTitle>
        <CardDescription>
          完整步驟見專案內{" "}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">docs/QA-CHECKLIST.md</code>
          。工作區帳務跨頁一致性見{" "}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">docs/WORKSPACE-SSOT-QA.md</code>
          。此區僅供內部驗收快速跳頁。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.href} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-border/70 pb-2 last:border-0">
              <Link href={it.href} className="font-medium text-ink underline-offset-4 hover:underline">
                {it.label}
              </Link>
              <span className="text-xs text-ink-secondary">{it.hint}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
