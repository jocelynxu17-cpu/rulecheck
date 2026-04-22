"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

function TeamMembersWorkspaceUrlSyncInner() {
  const sp = useSearchParams();
  const prefer = sp.get("workspace");
  const { workspaces, loading, selectedId, setSelectedId } = useWorkspace();

  useEffect(() => {
    if (loading || !prefer) return;
    if (!workspaces.some((w) => w.id === prefer)) return;
    if (prefer !== selectedId) setSelectedId(prefer);
  }, [loading, prefer, workspaces, selectedId, setSelectedId]);

  return null;
}

/** 支援 `/team/members?workspace=<uuid>`：若目前帳號隸屬該工作區，載入後自動切換。 */
export function TeamMembersWorkspaceUrlSync() {
  return (
    <Suspense fallback={null}>
      <TeamMembersWorkspaceUrlSyncInner />
    </Suspense>
  );
}
