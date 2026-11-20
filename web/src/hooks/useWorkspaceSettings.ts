import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/apis/queryKeys";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  type WorkspaceSettingsPatch,
} from "@/apis/workspace.api";
import { ApiError } from "@/types/api.type";

/*
  W04 워크스페이스 설정. 저장하면 응답으로 화면을 채우고,
  사이드바 계정 이름이 바뀌도록 로그인 상태를 다시 받습니다.
*/
export function useWorkspaceSettings() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.workspace.settings(),
    queryFn: getWorkspaceSettings,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403].includes(error.status)) && count < 1,
  });
  const save = useMutation({
    mutationFn: (body: WorkspaceSettingsPatch) => updateWorkspaceSettings(body),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.workspace.settings(), settings);
      void client.invalidateQueries({ queryKey: queryKeys.auth.session() });
    },
  });
  return { ...query, save };
}
