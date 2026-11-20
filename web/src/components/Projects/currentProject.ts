import { createContext, useContext } from "react";

import type { ProjectRecord } from "@/types/project.type";
import type { V1ProjectDetail } from "@/types/project.v1.type";

/*
  /projects/:projectId 아래 화면이 함께 쓰는 프로젝트. ProjectRoute 가 GET /api/v1/projects/{id} 로 받아 넣습니다.
  - id: 주소의 :projectId (숫자 id 문자열). buildPath 에 그대로 넘깁니다
  - v1Id: 제품 API 호출에 쓰는 숫자 id
*/
export type CurrentProject = {
  id: string;
  v1Id: number;
  name: string;
  url: string;
  isSample: boolean;
  /* C05~ 화면 머리말·개요용 화면 타입 */
  record: ProjectRecord;
  detail: V1ProjectDetail;
};

/* 주소의 :projectId 는 제품 API 의 숫자 id 입니다. 그 밖의 값은 찾을 수 없는 프로젝트로 봅니다 */
export function parseProjectId(value: string | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export const CurrentProjectContext = createContext<CurrentProject | null>(null);

export function useCurrentProject(): CurrentProject {
  const project = useContext(CurrentProjectContext);
  if (!project) throw new Error("useCurrentProject 는 ProjectRoute 안에서만 씁니다.");
  return project;
}
