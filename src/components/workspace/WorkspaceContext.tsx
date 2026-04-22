"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type WorkspaceListItem = {
  id: string;
  name: string;
  role: string;
  /** Workspace plan (team billing SSOT) */
  plan: string;
  subscriptionStatus: string | null;
  monthlyQuotaUnits: number;
  unitsUsedMonth: number;
  usageMonth: string;
};

type WorkspaceContextValue = {
  workspaces: WorkspaceListItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  /** Current auth user id (for members UI self vs others). */
  viewerUserId: string | null;
  loading: boolean;
  /** Set when GET /api/workspaces could not run ensure_user_workspace (or RPC returned ok: false). */
  ensureError: string | null;
  recovering: boolean;
  refresh: () => Promise<void>;
  recoverWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "rulecheck_workspace_id";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces", { credentials: "same-origin" });
      const data = (await res.json()) as {
        workspaces?: WorkspaceListItem[];
        ensureError?: string | null;
        viewerUserId?: string;
      };
      const list = data.workspaces ?? [];
      setViewerUserId(typeof data.viewerUserId === "string" ? data.viewerUserId : null);
      setEnsureError(list.length > 0 ? null : data.ensureError ?? null);
      setWorkspaces(list);
      setSelectedIdState((prev) => {
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem(STORAGE_KEY);
          const prefer = saved && list.some((w) => w.id === saved) ? saved : prev && list.some((w) => w.id === prev) ? prev : list[0]?.id ?? null;
          if (prefer) localStorage.setItem(STORAGE_KEY, prefer);
          return prefer;
        }
        return list[0]?.id ?? prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const recoverWorkspace = useCallback(async () => {
    setRecovering(true);
    try {
      const res = await fetch("/api/workspaces/ensure", { method: "POST", credentials: "same-origin" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        setEnsureError(body.error ?? "repair_failed");
        toast.error("仍無法建立工作區", { description: "請稍後重試或重新整理頁面。" });
        return;
      }
      await refresh();
      toast.success("工作區已就緒", { description: "多帳號可共用此工作區之審查額度。" });
    } finally {
      setRecovering(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo(
    () => ({
      workspaces,
      selectedId,
      setSelectedId,
      viewerUserId,
      loading,
      ensureError,
      recovering,
      refresh,
      recoverWorkspace,
    }),
    [workspaces, selectedId, setSelectedId, viewerUserId, loading, ensureError, recovering, refresh, recoverWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** Guest / marketing shell without provider — returns null. */
export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}
