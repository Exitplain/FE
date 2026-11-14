import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, getProjects, readProjectRecords } from "@/apis/project.api";
import { getProjectOverview } from "@/apis/project.api";

export const projectKeys = {
  all: ["project-demo", "list"] as const,
  overview: (id: string, unconnected: boolean) =>
    ["project-demo", "overview", id, unconnected] as const,
};
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: getProjects,
    initialData: readProjectRecords,
  });
}
export function useProjectOverview(id: string | undefined, unconnected: boolean) {
  return useQuery({
    queryKey: projectKeys.overview(id ?? "", unconnected),
    queryFn: () => getProjectOverview(id ?? "", unconnected),
    enabled: Boolean(id),
  });
}
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      client.setQueryData(projectKeys.all, readProjectRecords());
      await client.invalidateQueries({ queryKey: ["workspace-demo", "snapshot"] });
    },
  });
}
