import { readCreatedProjects } from "@/utils/projectRegistry";

/*
  프로젝트 예시 목록. 프로젝트 API(/api/v1/projects)가 아직 없어 사이드바와 프로젝트 화면이 함께 씁니다.
  API 가 붙으면 조회 결과로 바꾸고 이 파일을 지웁니다.
  url 은 Figma 예시 주소이며, 현재 BE 개발 API 는 반찬로드 모의 쇼핑몰만 실행합니다.
*/
export const SAMPLE_PROJECTS = [
  { id: "banchan", name: "반찬로드", url: "https://banchanroad.example" },
  { id: "studio", name: "스튜디오 예약", url: "https://studio.example" },
  { id: "phone", name: "중고폰 매입", url: "https://phonebuy.example" },
] as const;

export type SampleProject = { id: string; name: string; url: string };

export function findSampleProject(projectId: string | undefined): SampleProject | undefined {
  return (
    SAMPLE_PROJECTS.find((project) => project.id === projectId) ??
    readCreatedProjects().find((project) => project.id === projectId)
  );
}
