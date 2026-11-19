import { useRef, useState } from "react";

import Button from "@/components/Button/Button";
import Modal from "@/components/Modal/Modal";
import { ApiError } from "@/types/api.type";

type Project = { id: string; name: string };

/** Confirmation UI stays separate from the deletion API. */
export default function DeleteProjectDialog({
  project,
  onClose,
  onDelete,
}: {
  project: Project;
  onClose: () => void;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    if (!busy.current) onClose();
  };
  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await onDelete(project.id);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "RUN_IN_PROGRESS") {
        setError("진행 중인 테스트가 있어요. 끝나거나 중지한 뒤에 삭제해 주세요.");
      } else if (error instanceof ApiError && error.status === 401) {
        setError("로그인이 필요해요. 다시 로그인한 뒤 삭제해 주세요.");
      } else if (error instanceof ApiError && error.status === 403) {
        setError("이 프로젝트를 삭제할 권한이 없어요. 샘플 프로젝트는 삭제할 수 없어요.");
      } else if (error instanceof ApiError && error.status === 404) {
        setError("프로젝트를 찾을 수 없어요. 목록을 새로고침해 주세요.");
      } else {
        setError("프로젝트를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="프로젝트를 삭제하시겠습니까?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={close}>
            취소
          </Button>
          <Button
            disabled={pending}
            onClick={() => void confirm()}
            className="bg-danger text-surface active:bg-danger disabled:bg-danger disabled:text-surface disabled:opacity-50"
          >
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-subtle">
        <strong className="font-bold text-ink">{project.name}</strong> 프로젝트를 삭제합니다.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
