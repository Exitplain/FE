import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, getProjects } from "@/apis/project.api";
import { deleteProjectV1 } from "@/apis/project.v1.api";
import { queryKeys } from "@/apis/queryKeys";
import type { ProjectRecord } from "@/types/project.type";

/* 사이드바·C02 프로젝트 목록 (내 프로젝트 + 샘플). 로그인·로그아웃 때 useApplySession 이 다시 받게 합니다 */
export function useProjects({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.projectsV1.list(), queryFn: getProjects, enabled });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    /* 목록은 뒤에서 다시 받고, 만든 직후 개요로 바로 이동합니다 (기다리면 버튼이 "만드는 중…"에 머묾) */
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.projectsV1.all });
    },
  });
}

export function useDeleteProject(onDeleted: (projectId: number) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteProjectV1,
    retry: false,
    onSuccess: async (_data, projectId) => {
      // A list response started before deletion must not put the project back.
      await Promise.all([
        client.cancelQueries({ queryKey: queryKeys.projectsV1.list(), exact: true }),
        client.cancelQueries({ queryKey: queryKeys.projectsV1.detail(projectId), exact: true }),
      ]);
      // Leave a deleted project's route before its detail cache is removed.
      onDeleted(projectId);
      client.setQueryData<ProjectRecord[]>(queryKeys.projectsV1.list(), (previous) =>
        previous?.filter((project) => project.id !== String(projectId)),
      );
      client.removeQueries({ queryKey: queryKeys.projectsV1.detail(projectId), exact: true });
      client.removeQueries({ queryKey: queryKeys.runs.list(projectId) });
      client.removeQueries({ queryKey: queryKeys.runs.recent(projectId) });
      void client.invalidateQueries({ queryKey: queryKeys.projectsV1.list(), exact: true });
      void client.invalidateQueries({ queryKey: queryKeys.issues.all });
    },
  });
}
