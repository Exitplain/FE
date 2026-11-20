import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import WorkspaceState from "@/components/Workspace/WorkspaceState";
import { buildPath } from "@/constants/routes";

export default function ProjectUnavailable() {
  return (
    <WorkspaceState
      kind="empty"
      title="프로젝트를 찾을 수 없어요"
      description="주소를 확인하거나 프로젝트 목록에서 다시 선택해 주세요"
      action={
        <Link className={buttonVariants({ variant: "outline" })} to={buildPath("projectList")}>
          프로젝트 목록 보기
        </Link>
      }
    />
  );
}
