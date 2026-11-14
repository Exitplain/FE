import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  getWorkspaceSettings,
  getWorkspaceSnapshot,
  saveWorkspaceSettings,
} from "@/apis/workspace.api";

export const workspaceKeys = {
  snapshot: ["workspace-demo", "snapshot"] as const,
  settings: ["workspace-demo", "settings"] as const,
};

export function useWorkspaceData() {
  const query = useQuery({ queryKey: workspaceKeys.snapshot, queryFn: getWorkspaceSnapshot });
  const [params, setParams] = useSearchParams();
  const preview = params.get("state");
  return {
    ...query,
    isLoading: query.isPending || preview === "loading",
    isError: query.isError || preview === "error",
    isEmpty: preview === "empty",
    retry: () => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("state");
          return next;
        },
        { replace: true },
      );
      void query.refetch();
    },
  };
}

export function useWorkspaceSettings() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: workspaceKeys.settings, queryFn: getWorkspaceSettings });
  const mutation = useMutation({
    mutationFn: saveWorkspaceSettings,
    onSuccess: (settings) => client.setQueryData(workspaceKeys.settings, settings),
  });
  return { ...query, save: mutation };
}
