import { useRef } from "react";

import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";

/*
  P20 공유 링크 모달 (Figma Dialog/공유 링크 · 560).
  공유 API(/api/v1/reports/{id}/shares)가 아직 없어 링크는 임시로 실행 ID 로 만듭니다.
  API 가 생기면 응답의 url 로 바꿉니다. 복사하면 "링크를 복사했어요" 알림(Toast/Copied).
*/
export default function ShareModal({
  open,
  onClose,
  runId,
}: {
  open: boolean;
  onClose: () => void;
  runId: string;
}) {
  const show = useToastStore((state) => state.show);
  const inputRef = useRef<HTMLInputElement>(null);
  /* TODO(API): 공유 API 응답의 url 로 바꿉니다. 실행 ID 는 추측 가능해 공개 토큰으로 쓰면 안 됩니다 */
  const url = `${window.location.origin}${buildPath("sharedReport", { shareId: runId })}`;

  const copy = async () => {
    try {
      /* HTTPS 가 아니면 clipboard 가 없어 TypeError 가 나고 아래로 갑니다 */
      await navigator.clipboard.writeText(url);
      show("링크를 복사했어요");
    } catch {
      /* 직접 복사할 수 있게 링크를 골라 둡니다 */
      inputRef.current?.focus();
      inputRef.current?.select();
      show("링크를 복사하지 못했어요. 직접 선택해 복사해 주세요", "status-error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="공유 링크" size="sm">
      <p className="text-sm text-gray-800">
        링크가 있는 사람은 로그인 없이 이 리포트를 읽기 전용으로 볼 수 있어요. 세션 상세와
        스크린샷도 보여요.
      </p>
      <div className="flex items-end gap-3">
        <Field label="링크" className="flex-1">
          {(control) => (
            <Input
              {...control}
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="border border-gray-300 text-gray-800"
            />
          )}
        </Field>
        <Button onClick={() => void copy()}>복사</Button>
      </div>
    </Modal>
  );
}
