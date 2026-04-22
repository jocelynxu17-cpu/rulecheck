"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

/**
 * Shown when workspace list is empty or ensure failed — keeps multi-account flow recoverable without blank screens.
 */
export function WorkspaceRecoveryBanner({ lead }: { lead?: string }) {
  const { loading, workspaces, ensureError, recovering, recoverWorkspace } = useWorkspace();
  const router = useRouter();

  if (loading) return null;

  const empty = workspaces.length === 0;
  if (!empty && !ensureError) return null;

  return (
    <Card className="border-amber-200/80 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-950">
          {ensureError ? "工作區初始化未完成" : "尚未載入工作區"}
        </CardTitle>
        <CardDescription className="text-amber-900/85">
          {ensureError
            ? ensureError
            : "若你為既有帳號，系統可自動建立預設工作區並擔任擁有者；亦可手動修復後重新整理。"}
          {lead ? ` ${lead}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" className="rounded-xl" disabled={recovering} onClick={() => void recoverWorkspace()}>
          {recovering ? "處理中…" : "修復並同步工作區"}
        </Button>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => router.refresh()}>
          重新整理頁面
        </Button>
      </CardContent>
    </Card>
  );
}
