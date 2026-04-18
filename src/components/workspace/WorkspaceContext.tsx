"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
  loading: boolean;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "rulecheck_workspace_id";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces", { credentials: "same-origin" });
      const data = (await res.json()) as { workspaces?: WorkspaceListItem[] };
      const list = data.workspaces ?? [];
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
      loading,
      refresh,
    }),
    [workspaces, selectedId, setSelectedId, loading, refresh]
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
