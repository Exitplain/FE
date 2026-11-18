import { http, HttpResponse } from "msw";

import type { SourceSnapshot } from "@/types/source.type";

/*
  코드 연결 mock (BE sources). 브라우저 mock 은 조회마다 진행 한 줄씩, 테스트는 첫 조회에 끝냅니다.
  저장소 주소에 "missing" 이 들어 있으면 받기 실패(GIT_CLONE_FAILED)로 끝납니다.
*/
const SCRIPT = [
  "저장소를 받는 중이에요",
  "commit a2d43dd 으로 고정했어요",
  "파일 11개를 받았어요 · 저장하지 않음: 비밀값으로 보이는 파일 1개",
  "코드 구조를 읽는 중이에요",
  "static · static-html 구조로 읽었어요",
  "화면 경로 15개, 화면 이동 44개를 찾았어요",
  "정적 사이트라 URL 없이도 바로 열 수 있어요",
];
const STEP = import.meta.env.MODE === "test" ? SCRIPT.length : 1;

type Stored = { snapshot: SourceSnapshot; shown: number; fail: boolean };
const store = new Map<string, Stored>();
let seq = 0;

export function resetSourceMock() {
  store.clear();
  seq = 0;
}

function progress(shown: number, end?: { kind: string; message: string }) {
  const lines = [
    { kind: "queued", message: "코드 받기를 시작했어요" },
    ...SCRIPT.slice(0, shown).map((message) => ({ kind: "step", message })),
    ...(end ? [end] : []),
  ];
  return lines.map((line, index) => ({ ...line, seq: index + 1, t: index }));
}

function base(
  projectId: number,
  provider: "zip" | "git",
  url = "",
  ref = "",
  subdirectory = "",
): SourceSnapshot {
  const now = new Date().toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    project_id: projectId,
    connection_id: provider === "git" ? 1 : 2,
    provider,
    repository_url: url,
    connection_status: "active",
    ref,
    commit_sha: "",
    subdirectory,
    tree_digest: "",
    state: "running",
    runnable: "unknown",
    static_root: "",
    file_count: 0,
    total_bytes: 0,
    skipped: {},
    framework: {},
    analysis: {},
    progress: progress(0),
    error: null,
    files_available: false,
    created_at: now,
    updated_at: now,
  };
}

function finish(s: SourceSnapshot, git: boolean): SourceSnapshot {
  return {
    ...s,
    state: "ready",
    commit_sha: git ? "a2d43dd1f0c0d1b2a3f4e5d6c7b8a9f0e1d2c3b4" : "",
    tree_digest: "f".repeat(64),
    runnable: "static",
    file_count: 11,
    total_bytes: 230_000,
    skipped: { secret_like: 1 },
    framework: { framework: "static", router: "static-html", status: "ok", reason: null },
    analysis: {
      status: "ok",
      routes: [
        { pattern: "/", file: "assets/app.js", line: 40, dynamic: false },
        { pattern: "/product", file: "assets/app.js", line: 40, dynamic: false },
      ],
      counts: { routes: 15, edges: 17, global_edges: 27, unresolved: 0 },
    },
    files_available: true,
    previewable: true,
    progress: progress(SCRIPT.length, { kind: "ready", message: "코드를 준비했어요" }),
  };
}

export const sourceHandlers = [
  http.post("*/api/v1/projects/:projectId/source-snapshots", async ({ params, request }) => {
    const projectId = Number(params.projectId);
    const type = request.headers.get("Content-Type") ?? "";
    let snapshot: SourceSnapshot;
    let fail = false;
    if (!type.includes("application/json")) {
      /*
        multipart: jsdom 은 FormData 본문을 formData() 로 다시 읽지 못하고 파일 이름도 "blob" 으로 보내,
        여기서는 zip 여부를 검사하지 않습니다 (실서버 BE 가 검사, 화면은 accept=".zip" 으로 고르게 함).
      */
      const raw = await request.text();
      const sub = /name="subdirectory"\r?\n\r?\n([^\r\n]*)/.exec(raw)?.[1] ?? "";
      snapshot = base(projectId, "zip", "", "", sub);
    } else {
      const body = (await request.json()) as {
        git_url?: string;
        ref?: string;
        subdirectory?: string;
      };
      if (!/^https:\/\/(github\.com|gitlab\.com)\/[^/]+\/[^/]+/.test(body.git_url ?? "")) {
        return HttpResponse.json(
          {
            error: {
              code: "GIT_URL_INVALID",
              message: "지금은 github.com, gitlab.com 의 공개 저장소만 받을 수 있어요.",
              fields: {},
            },
          },
          { status: 422 },
        );
      }
      fail = (body.git_url ?? "").includes("missing");
      snapshot = base(projectId, "git", body.git_url, body.ref ?? "", body.subdirectory ?? "");
    }
    store.set(snapshot.id, { snapshot, shown: 0, fail });
    return HttpResponse.json(snapshot, { status: 202 });
  }),
  http.get("*/api/v1/source-snapshots/:snapshotId", ({ params }) => {
    const item = store.get(String(params.snapshotId));
    if (!item) {
      return HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "코드 스냅샷을 찾을 수 없습니다.", fields: {} } },
        { status: 404 },
      );
    }
    item.shown = Math.min(SCRIPT.length, item.shown + STEP);
    const git = item.snapshot.provider === "git";
    if (item.fail) {
      item.snapshot = {
        ...item.snapshot,
        state: "failed",
        error: {
          code: "GIT_CLONE_FAILED",
          message: "저장소를 받지 못했어요. 공개 저장소인지, 브랜치 이름이 맞는지 확인해주세요.",
        },
        progress: progress(1, { kind: "failed", message: "저장소를 받지 못했어요" }),
      };
    } else if (item.shown >= SCRIPT.length) {
      item.snapshot = finish(item.snapshot, git);
    } else {
      item.snapshot = { ...item.snapshot, progress: progress(item.shown) };
    }
    return HttpResponse.json(item.snapshot);
  }),
];
