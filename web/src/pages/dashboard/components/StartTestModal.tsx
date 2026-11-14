import { useState } from "react";
import { useNavigate } from "react-router-dom";

import shield from "@/assets/workspace/shield.svg";
import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import type { WorkspaceProject } from "@/types/workspace.type";

import ProjectPicker from "./ProjectPicker";

export default function StartTestModal({
  open,
  onClose,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  projects: WorkspaceProject[];
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const navigate = useNavigate();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 테스트 시작"
      description="프로젝트를 고르면 사이트 기능부터 살펴보고 테스트할 목표를 제안해요"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="outline"
            disabled={!projectId || !projects.some((project) => project.id === projectId)}
            onClick={() => {
              onClose();
              navigate(buildPath("newTest", { projectId }));
            }}
          >
            계속
          </Button>
        </>
      }
    >
      <Field label="프로젝트" hint="필수">
        {(control) => (
          <ProjectPicker
            id={control.id}
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            onCreate={() => {
              onClose();
              navigate(`${buildPath("projectList")}?create=1`);
            }}
          />
        )}
      </Field>
      <div className="workspace-start-checks rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 text-caption font-bold">먼저 자동으로 확인해요</h3>
        {[
          "서비스 소개와 시작 경로",
          "화면에서 찾은 가입·로그인 진입 경로",
          "화면 근거 저장 · 로그인 연결이 필요한지 안내",
        ].map((label) => (
          <p key={label} className="flex min-h-10 items-center gap-2 text-sm">
            <Icon name="check" />
            {label}
          </p>
        ))}
      </div>
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-caption text-subtle">
        <img src={shield} alt="" className="size-5 shrink-0" />
        로그인·가입 제출·파일 업로드·결제는 하지 않아요
      </p>
    </Modal>
  );
}
