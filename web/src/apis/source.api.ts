import type { GitSourceRequest, SourceSnapshot } from "@/types/source.type";

import axiosInstance from "./axiosInstance";

/*
  코드 연결 (P02 "코드만 있어요"). 로그인 + 프로젝트 소유자만 됩니다.
  두 요청 모두 바로 202(state "running")로 돌아오고, 받기·분석은 서버에서 이어집니다 (getSourceSnapshot 으로 진행 확인).
*/

/* 공개 https 저장소 (GitHub·GitLab) */
export async function createGitSnapshot(
  projectId: number,
  body: GitSourceRequest,
): Promise<SourceSnapshot> {
  const { data } = await axiosInstance.post<SourceSnapshot>(
    `/api/v1/projects/${projectId}/source-snapshots`,
    body,
  );
  return data;
}

/* zip 업로드 (최대 30MB). 브라우저가 multipart 경계를 넣도록 Content-Type 은 비웁니다 */
export async function createZipSnapshot(
  projectId: number,
  file: File,
  subdirectory = "",
): Promise<SourceSnapshot> {
  const form = new FormData();
  form.append("file", file);
  if (subdirectory) form.append("subdirectory", subdirectory);
  const { data } = await axiosInstance.post<SourceSnapshot>(
    `/api/v1/projects/${projectId}/source-snapshots`,
    form,
    { headers: { "Content-Type": undefined } },
  );
  return data;
}

export async function getSourceSnapshot(snapshotId: string): Promise<SourceSnapshot> {
  const { data } = await axiosInstance.get<SourceSnapshot>(
    `/api/v1/source-snapshots/${snapshotId}`,
  );
  return data;
}
