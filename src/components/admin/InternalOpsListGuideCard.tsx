import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Brief reminder on list routes: bounded rows, pagination, drill-down elsewhere.
 */
export function InternalOpsListGuideCard({
  summary,
  bullets,
}: {
  summary?: string;
  bullets?: string[];
}) {
  const defaults = [
    "列表預設僅載入固定頁長，請用分頁與搜尋縮小範圍。",
    "精細狀態請至對應「明細頁」（工作區／使用者／稽核／帳務）。",
    "標註「抽樣／上限」之數字為巡檢用，非全表掃描結果。",
  ];
  const items = bullets && bullets.length ? bullets : defaults;

  return (
    <Card className="border-dashed border-surface-border bg-canvas/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">營運列表 · 擴展性說明</CardTitle>
        <CardDescription>
          {summary ??
            "摘要優先、明細在專頁；大量資料時避免把完整事件流塞進單一列表。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-ink-secondary">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
