import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { queryKeys } from "@/apis/queryKeys";
import { createShareLink, getShareLinks } from "@/apis/report.api";
import Button from "@/components/Button/Button";
import Field from "@/components/Field/Field";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal/Modal";
import { buildPath } from "@/constants/routes";
import { useToastStore } from "@/stores/useToastStore";
import type { ShareLink } from "@/types/report.type";

/*
  P20 공유 링크 모달 (Figma Dialog/공유 링크 · 560).
  - 열면 이 리포트의 공유 링크 목록을 보고, 쓸 수 있는(active) 링크가 있으면 그대로 씁니다.
    없으면 새로 만듭니다 (POST /api/v1/reports/{id}/share-links, 기본 7일).
  - 화면 주소는 /share/{token} 입니다. 서버 응답의 path(/api/v1/shared/{token})는 API 주소라 쓰지 않습니다.
  복사하면 "링크를 복사했어요" 알림(Toast/Copied).
*/
export default function ShareModal({
  open,
  onClose,
  reportId,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
  /* 보고 있던 과업을 받는 사람도 먼저 보도록 ?task= 로 붙입니다 */
  taskId?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="공유 링크" size="sm">
      <p className="text-sm text-gray-800">
        링크가 있는 사람은 로그인 없이 이 리포트를 읽기 전용으로 볼 수 있어요.
      </p>
      {open && <ShareLinkField reportId={reportId} taskId={taskId} />}
    </Modal>
  );
}

function activeLink(links: ShareLink[] | undefined) {
  return links?.find((link) => link.state === "active");
}

function ShareLinkField({ reportId, taskId }: { reportId: string; taskId?: string }) {
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const links = useQuery({
    queryKey: queryKeys.reports.shareLinks(reportId),
    queryFn: () => getShareLinks(reportId),
  });
  const mutationKey = ["share-link-create", reportId];
  const create = useMutation({
    mutationKey,
    mutationFn: () => createShareLink(reportId),
    onSuccess: (created) => {
      client.setQueryData<ShareLink[]>(queryKeys.reports.shareLinks(reportId), (previous) => [
        created,
        ...(previous ?? []).filter((item) => item.id !== created.id),
      ]);
      void client.invalidateQueries({ queryKey: queryKeys.reports.shareLinks(reportId) });
    },
  });
  /* 모달을 닫았다 다시 열어도 앞서 보낸 만들기 요청이 진행 중이면 또 만들지 않습니다 */
  const creating = useIsMutating({ mutationKey }) > 0;

  /* 목록을 다시 받는 사이 방금 만든 링크가 빠져도 화면이 "만드는 중"에 멈추지 않게 만든 링크를 함께 봅니다 */
  const link =
    activeLink(links.data) ?? (create.data?.state === "active" ? create.data : undefined);
  /* 받아 둔 목록이 오래됐을 수 있어 다시 받기가 끝난 뒤에만 판단합니다 */
  const needsLink = links.isSuccess && !links.isFetching && !link;
  /*
    쓸 수 있는 링크가 없을 때 이 모달에서 한 번만 만듭니다 (실패하면 버튼으로 다시).
    ref 는 StrictMode 가 effect 를 두 번 실행해도 요청이 두 번 나가지 않게 합니다.
  */
  const requested = useRef(false);
  const { mutate } = create;
  useEffect(() => {
    if (!needsLink || creating || requested.current) return;
    requested.current = true;
    mutate();
  }, [needsLink, creating, mutate]);

  const failed = links.isError || create.isError;
  if (failed) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink">공유 링크를 만들지 못했어요.</p>
        <Button
          variant="secondary"
          icon="retry"
          onClick={() => {
            if (links.isError) void links.refetch();
            else create.mutate();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }
  if (!link) {
    return (
      <p role="status" className="text-sm text-muted">
        공유 링크를 만드는 중이에요…
      </p>
    );
  }

  const query = taskId ? `?task=${encodeURIComponent(taskId)}` : "";
  const url = `${window.location.origin}${buildPath("sharedReport", { shareId: link.token })}${query}`;

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
  );
}
