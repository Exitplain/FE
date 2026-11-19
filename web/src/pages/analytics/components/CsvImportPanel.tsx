import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import {
  deleteMeasurementImport,
  getMeasurementCsvTemplate,
  getMeasurementImports,
  uploadMeasurementCsv,
} from "@/apis/measurement.api";
import { queryKeys } from "@/apis/queryKeys";
import Button from "@/components/Button/Button";
import Icon from "@/components/Icon/Icon";
import { downloadFile } from "@/pages/report/utils/downloadFile";
import { useToastStore } from "@/stores/useToastStore";
import type { ApiError } from "@/types/api.type";
import type { MeasurementImportResult } from "@/types/measurement.type";

/* CSV 열 설명 (BE measurements/csv_import.py 와 같은 규칙) */
const COLUMNS: { name: string; required: boolean; description: string; example: string }[] = [
  {
    name: "session_id",
    required: true,
    description: "같은 방문을 묶는 값. 회원 ID·이메일이어도 원래 값은 저장하지 않아요",
    example: "a81f3c",
  },
  {
    name: "timestamp",
    required: true,
    description: "화면을 연 시각. 시간대가 없으면 한국 시간으로 봐요 (유닉스 초·밀리초도 돼요)",
    example: "2026-11-18 14:03:22",
  },
  {
    name: "path",
    required: true,
    description: "연 화면의 경로나 전체 주소. ? 와 # 뒤는 버려요",
    example: "/product/12",
  },
  {
    name: "step",
    required: false,
    description: "경로 대신 쓰는 단계 이름 (영문·숫자·-·_). 앱 이벤트 이름을 넣어도 돼요",
    example: "cart",
  },
  {
    name: "device",
    required: false,
    description: "mobile 또는 desktop. 없으면 screen_width(숫자)로 나눠요",
    example: "desktop",
  },
];

const EXAMPLE_ROWS = [
  ["a81f3c", "2026-11-18 14:03:22", "/", "", "desktop"],
  ["a81f3c", "2026-11-18 14:03:40", "/product/12", "", "desktop"],
  ["a81f3c", "2026-11-18 14:04:05", "/cart", "cart", "desktop"],
  ["b27d90", "2026-11-18T15:10:00+09:00", "https://shop.example.com/", "", "mobile"],
];

const RULES = [
  "한 줄 = 방문자 한 명이 화면 하나를 연 기록이에요 (스크립트가 보내는 것과 같아요)",
  "최근 30일 안의 기록만 넣어요 · 5MB, 10만 줄까지 · 같은 파일은 한 번만",
  "경로의 숫자·이메일 같은 조각은 :id 로 바꿔 저장해요 (/product/12 → /product/:id)",
  "올린 뒤 단계 매핑에서 사전 테스트 화면에 연결하면 예측과 비교해요",
];

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
});

function period(first: string | null, last: string | null) {
  if (!first || !last) return "";
  const from = dateFormat.format(new Date(first));
  const to = dateFormat.format(new Date(last));
  return from === to ? from : `${from} ~ ${to}`;
}

/*
  R01b 실측 CSV 올리기 — 스크립트를 넣을 수 없는 사이트가 방문 로그를 CSV 로 내보내 올립니다.
  형식 설명·예시 표·예시 파일 받기 → 파일 올리기 → 결과(넣은 줄·건너뛴 줄과 이유) → 올린 파일 목록(지우기).
*/
export default function CsvImportPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const imports = useQuery({
    queryKey: queryKeys.measurementImports(projectId),
    queryFn: () => getMeasurementImports(projectId),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.measurement(projectId) });
  };

  const upload = useMutation<MeasurementImportResult, ApiError, File>({
    mutationFn: (file) => uploadMeasurementCsv(projectId, file),
    onSuccess: refresh,
  });
  const remove = useMutation<void, ApiError, number>({
    mutationFn: (importId) => deleteMeasurementImport(projectId, importId),
    onSuccess: () => {
      upload.reset();
      refresh();
      useToastStore.getState().show("올린 파일과 그 기록을 지웠어요");
    },
  });
  const template = useMutation<Blob, ApiError>({
    mutationFn: () => getMeasurementCsvTemplate(projectId),
    onSuccess: (blob) => downloadFile(blob, "exitplain-measurement-template.csv"),
    onError: () => useToastStore.getState().show("예시 파일을 받지 못했어요", "info"),
  });

  const result = upload.data;
  const skipped = result
    ? result.skipped.invalid + result.skipped.outside_window + result.skipped.duplicate
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="csv-format-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="csv-format-title" className="text-lg font-bold text-ink">
            1. CSV 형식
          </h2>
          <Button
            variant="secondary"
            disabled={template.isPending}
            onClick={() => template.mutate()}
          >
            예시 파일 받기
          </Button>
        </div>
        <p className="text-caption text-subtle">
          스크립트를 넣을 수 없으면, 사이트의 방문 로그를 아래 열로 내보내 올려 주세요
        </p>
        <table className="w-full text-left text-caption">
          <caption className="sr-only">CSV 열</caption>
          <thead className="text-subtle">
            <tr className="border-b border-line">
              <th className="py-2 font-medium">열</th>
              <th className="py-2 font-medium">필수</th>
              <th className="py-2 font-medium">설명</th>
              <th className="py-2 font-medium">예시</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map((column) => (
              <tr key={column.name} className="border-b border-line last:border-b-0">
                <td className="py-2 font-mono text-ink">{column.name}</td>
                <td className="py-2 text-gray-800">{column.required ? "필수" : "선택"}</td>
                <td className="py-2 text-gray-800">{column.description}</td>
                <td className="py-2 font-mono text-subtle">{column.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col gap-1">
          <p className="text-caption font-bold text-ink">예시</p>
          <pre
            aria-label="CSV 예시"
            className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-caption text-ink"
          >
            {[COLUMNS.map((column) => column.name), ...EXAMPLE_ROWS]
              .map((row) => row.join(","))
              .join("\n")}
          </pre>
        </div>
        <ul className="flex flex-col gap-1 text-caption text-subtle">
          {RULES.map((rule) => (
            <li key={rule}>· {rule}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="csv-upload-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="csv-upload-title" className="text-lg font-bold text-ink">
            2. CSV 올리기
          </h2>
          <Button disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? "올리는 중…" : "CSV 파일 올리기"}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV 파일"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate(file);
            }}
          />
        </div>
        {upload.isError && (
          <div role="alert" className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-caption">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon name="status-error" className="size-5 text-danger" />
              {upload.error.message}
            </p>
            {Array.isArray(upload.error.fields?.rows) && (
              <ul className="pl-7 text-gray-800">
                {(upload.error.fields.rows as string[]).map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result && (
          <div role="status" className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 text-caption">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon name="status-done" className="size-5" />
              {result.rows_imported.toLocaleString()}줄을 넣었어요 · 방문 {result.sessions}회
              {result.first_at && ` · ${period(result.first_at, result.last_at)}`}
            </p>
            {skipped > 0 && (
              <p className="pl-7 text-gray-800">
                {skipped}줄은 건너뛰었어요 · 형식 오류 {result.skipped.invalid} · 30일 밖{" "}
                {result.skipped.outside_window} · 중복 {result.skipped.duplicate}
              </p>
            )}
            {result.errors.length > 0 && (
              <ul aria-label="건너뛴 줄" className="pl-7 text-subtle">
                {result.errors.map((error) => (
                  <li key={error.line}>
                    {error.line}번째 줄: {error.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {imports.data && imports.data.length > 0 && (
          <ul aria-label="올린 파일" className="flex flex-col">
            {imports.data.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3 text-caption last:border-b-0"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{item.filename || "이름 없는 파일"}</span>
                  <span className="text-subtle">
                    {item.rows_imported.toLocaleString()}줄 · 방문 {item.sessions}회
                    {item.first_at && ` · ${period(item.first_at, item.last_at)}`}
                  </span>
                </span>
                <Button
                  variant="link"
                  disabled={remove.isPending}
                  aria-label={`${item.filename || "이름 없는 파일"} 지우기`}
                  onClick={() => remove.mutate(item.id)}
                >
                  지우기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
