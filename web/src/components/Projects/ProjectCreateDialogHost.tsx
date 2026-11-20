import { useLocation, useSearchParams } from "react-router-dom";

import { ROUTES } from "@/constants/routes";

import CreateProjectModal from "./CreateProjectModal";

/* 목록 페이지는 자체 모달을 사용합니다. 다른 화면은 현재 경로를 유지하고 C03만 올립니다. */
export default function ProjectCreateDialogHost() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  if (params.get("create") !== "1" || pathname.replace(/\/+$/, "") === ROUTES.projectList.path)
    return null;
  return (
    <CreateProjectModal
      onClose={() =>
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.delete("create");
            return next;
          },
          { replace: true },
        )
      }
    />
  );
}
