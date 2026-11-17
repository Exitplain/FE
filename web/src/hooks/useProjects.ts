import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, getProjects } from "@/apis/project.api";
import { queryKeys } from "@/apis/queryKeys";

/* 사이드바·C02 프로젝트 목록 (내 프로젝트 + 샘플). 로그인·로그아웃 때 useApplySession 이 다시 받게 합니다 */
export function useProjects() {
  return useQuery({ queryKey: queryKeys.projectsV1.list(), queryFn: getProjects });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    /* 목록은 뒤에서 다시 받고, 만든 직후 개요로 바로 이동합니다 (기다리면 버튼이 "만드는 중…"에 머묾) */
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.projectsV1.all });
      void client.invalidateQueries({ queryKey: ["workspace-demo", "snapshot"] });
    },
  });
}
