import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { getMeasurementMapping, saveMeasurementMapping } from "@/apis/measurement.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import ProjectPageHeader from "@/components/ProjectPageHeader/ProjectPageHeader";
import { useToastStore } from "@/stores/useToastStore";
import type { MeasurementMapping } from "@/types/measurement.type";

import MappingView from "./MappingView";

type Props = {
  projectId: number;
  breadcrumb: string;
  onCancel: () => void;
  onSaved: () => void;
};

/*
  R05 화면 전체 (머리말 취소·매핑 저장 + 표).
  GET /measurement/mapping 행의 stage_id(저장값, 없으면 자동 추천)를 초안으로 두고, 저장하면 모든 행을 통째로 PUT 합니다.
*/
export default function MappingStep(props: Props) {
  const { projectId, onCancel } = props;
  const query = useQuery({
    queryKey: queryKeys.measurementMapping(projectId),
    queryFn: () => getMeasurementMapping(projectId),
  });
  const data = query.data;

  if (data && data.stages.length > 0 && data.rows.length > 0) {
    return <MappingEditor key={data.saved_at ?? "new"} data={data} {...props} />;
  }
  const cancel = (
    <Button variant="secondary" onClick={onCancel}>
      취소
    </Button>
  );
  return (
    <Frame {...props} actions={cancel}>
      {query.isPending ? (
        <p className="text-sm text-subtle">불러오는 중이에요…</p>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-4 rounded-xl bg-gray-50 p-6">
          <p role="alert" className="text-sm text-subtle">
            {query.error.message}
          </p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            다시 불러오기
          </Button>
        </div>
      ) : data?.reason === "NO_PREDICTION" ? (
        <p className="rounded-xl bg-gray-50 p-6 text-sm text-subtle">{data.message}</p>
      ) : (
        <MappingView stages={data?.stages ?? []} rows={[]} draft={{}} onChange={() => {}} />
      )}
    </Frame>
  );
}

function Frame({
  projectId,
  breadcrumb,
  actions,
  children,
}: Props & { actions: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-12">
      <ProjectPageHeader
        projectId={String(projectId)}
        breadcrumb={breadcrumb}
        title="이벤트 단계 매핑"
        description="실제 고객 데이터 이벤트를 이동 단계에 연결해요 · 비교 기준이에요"
        actions={actions}
        activeTab="analytics"
      />
      {children}
    </div>
  );
}

function MappingEditor({ data, ...props }: Props & { data: MeasurementMapping }) {
  const { projectId, onCancel, onSaved } = props;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(data.rows.map((row) => [row.step_id, row.stage_id])),
  );
  const save = useMutation({
    mutationFn: () => saveMeasurementMapping(projectId, draft),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.measurementMapping(projectId), next);
      useToastStore.getState().show("매핑을 저장했어요");
      onSaved();
    },
  });

  return (
    <Frame
      {...props}
      actions={
        <>
          {save.isError && (
            <span role="alert" className="text-caption text-danger">
              {save.error.message}
            </span>
          )}
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "저장 중…" : "매핑 저장"}
          </Button>
        </>
      }
    >
      <MappingView
        stages={data.stages}
        rows={data.rows}
        draft={draft}
        onChange={(stepId, stageId) => setDraft((current) => ({ ...current, [stepId]: stageId }))}
      />
    </Frame>
  );
}
