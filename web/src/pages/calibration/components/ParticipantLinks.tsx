import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getObservations } from "@/apis/calibration.api";
import {
  createParticipantLink,
  disableParticipantLink,
  getParticipantLinks,
} from "@/apis/participant.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import SegmentedTabs from "@/components/SegmentedTabs/SegmentedTabs";
import { useToastStore } from "@/stores/useToastStore";
import type { ParticipantLink } from "@/types/calibration.type";

const STATE_LABEL: Record<ParticipantLink["state"], string> = {
  open: "받는 중",
  disabled: "닫힘",
  expired: "기한 지남",
  full: "다 모임",
};
const PURPOSES = [
  { value: "calibration", label: "보정용" },
  { value: "evaluation", label: "평가용" },
] as const;

const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

function linksKey(projectId: string) {
  return [...queryKeys.calibration.all, projectId, "participant-links"] as const;
}

/*
  참여자 응답 링크 관리 (PART-01). 실측 분석(미연결)·보정 → 사람 관측 두 곳에서 씁니다.
  링크가 있으면 목록(복사·닫기), 없으면 "응답 링크 만들기". 링크를 연 참여자는 그 안에서 사이트를 열고 답합니다.
  고객 사이트에는 아무것도 넣지 않아요 — URL만 있는 프로젝트도 사람 관측을 모을 수 있어요.
*/
export default function ParticipantLinks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const links = useQuery({
    queryKey: linksKey(projectId),
    queryFn: () => getParticipantLinks(projectId),
  });
  const tasks = useQuery({
    queryKey: [...queryKeys.calibration.all, projectId, "observations"] as const,
    queryFn: () => getObservations(projectId),
  });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<ParticipantLink["purpose"]>("calibration");
  const options = tasks.data?.tasks ?? [];
  const chosen = taskId ?? options[0]?.task_id ?? null;

  const create = useMutation({
    mutationFn: () => createParticipantLink(projectId, { task_id: chosen ?? "", purpose }),
    onSuccess: async () => {
      useToastStore.getState().show("응답 링크를 만들었어요");
      await queryClient.invalidateQueries({ queryKey: linksKey(projectId) });
    },
  });
  const close = useMutation({
    mutationFn: (id: number) => disableParticipantLink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: linksKey(projectId) }),
  });
  const copy = async (link: ParticipantLink) => {
    const url = `${window.location.origin}${link.path}`;
    try {
      await navigator.clipboard.writeText(url);
      useToastStore.getState().show("링크를 복사했어요");
    } catch {
      useToastStore.getState().show(url, "info");
    }
  };

  return (
    <section
      aria-labelledby="participant-links-title"
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="participant-links-title" className="text-base font-bold text-ink">
          참여자 응답 링크
        </h2>
        <p className="text-caption text-subtle">
          사이트에 코드를 넣지 않아도 돼요. 링크를 받은 참여자가 사이트를 열어 과업을 해 보고, 가장
          불편했던 화면·이유를 눌러서 답해요 (타이핑 없음 · 이름·연락처 안 받음)
        </p>
      </div>

      {links.data && links.data.length > 0 && (
        <ul aria-label="응답 링크" className="flex flex-col">
          {links.data.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-caption last:border-b-0"
            >
              <span className="font-bold text-ink">{link.task_name}</span>
              <span className="text-subtle">
                {link.purpose === "evaluation" ? "평가용" : "보정용"} · {STATE_LABEL[link.state]} ·
                응답 {link.responses}/{link.max_responses} ·{" "}
                {dayFormat.format(new Date(link.expires_at))}
                까지
              </span>
              <span className="ml-auto flex gap-2">
                {link.state === "open" && (
                  <>
                    <Button variant="secondary" onClick={() => void copy(link)}>
                      링크 복사
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={close.isPending}
                      onClick={() => close.mutate(link.id)}
                    >
                      닫기
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tasks.data && !tasks.data.report_id ? (
        <p className="text-caption text-subtle">
          먼저 사전 테스트를 한 번 실행해야 링크를 만들 수 있어요 (화면 캡처를 보여 줘야 해서요)
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {options.length > 1 && (
            <SegmentedTabs
              label="과업"
              options={options.map((item) => ({ value: item.task_id, label: item.name }))}
              value={chosen ?? ""}
              onChange={setTaskId}
            />
          )}
          <SegmentedTabs label="용도" options={PURPOSES} value={purpose} onChange={setPurpose} />
          <Button disabled={!chosen || create.isPending} onClick={() => create.mutate()}>
            응답 링크 만들기
          </Button>
          {create.isError && (
            <span role="alert" className="text-caption text-danger">
              {create.error.message}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
