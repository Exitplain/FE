import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { WorkspaceSettingsResponse } from "@/apis/workspace.api";
import { server } from "@/mocks/node";
import { renderWithProviders } from "@/test/renderWithProviders";

import SettingsPage from ".";

const settings = (
  overrides: Partial<WorkspaceSettingsResponse> = {},
): WorkspaceSettingsResponse => ({
  workspace: { id: "ws-1", name: "My workspace", role: "owner" },
  me: { id: 1, email: "maker@example.com", name: "메이커" },
  run_defaults: {
    viewport_width: 390,
    concurrency: 5,
    request_interval_seconds: 1,
    seed_count: 1,
    max_steps: 40,
    timeout_seconds: 300,
    cost_cap: null,
  },
  ...overrides,
});

/* GET 은 주어진 설정, PATCH 는 받은 본문을 기록하고 바꾼 설정을 돌려줍니다 */
function serveSettings(initial: WorkspaceSettingsResponse) {
  const patches: unknown[] = [];
  server.use(
    http.get("*/api/v1/workspace", () => HttpResponse.json(initial)),
    http.patch("*/api/v1/workspace", async ({ request }) => {
      const body = (await request.json()) as { workspace_name?: string; my_name?: string };
      patches.push(body);
      return HttpResponse.json(
        settings({
          workspace: {
            ...initial.workspace!,
            name: body.workspace_name ?? initial.workspace!.name,
          },
          me: { ...initial.me, name: body.my_name ?? initial.me.name },
        }),
      );
    }),
  );
  return patches;
}

describe("W04 워크스페이스 설정 (GET·PATCH /api/v1/workspace)", () => {
  it("서버 값과 실행 기본값을 보여 주고, 바꾼 값만 저장한 뒤 버튼을 끄고 알린다 (W04b)", async () => {
    const user = userEvent.setup();
    const patches = serveSettings(settings());
    renderWithProviders(<SettingsPage />);

    const name = await screen.findByRole("textbox", { name: "워크스페이스 이름" });
    expect(name).toHaveValue("My workspace");
    expect(screen.getByRole("textbox", { name: "이메일" })).toHaveValue("maker@example.com");
    expect(screen.getByText("동시 세션").nextElementSibling).toHaveTextContent("최대 5");
    expect(screen.getByText("LLM 비용 상한").nextElementSibling).toHaveTextContent(
      "실행당 상한 (값 확인 필요)",
    );
    const save = screen.getByRole("button", { name: "저장" });
    expect(save).toBeDisabled();

    await user.clear(name);
    await user.click(save);
    expect(screen.getByText("워크스페이스 이름을 입력해 주세요")).toBeInTheDocument();
    await user.type(name, "팀 워크스페이스");
    await user.click(save);

    expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장했어요");
    expect(patches).toEqual([{ workspace_name: "팀 워크스페이스" }]);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("관리 권한이 없으면 워크스페이스 이름을 잠그고 내 이름만 보낸다", async () => {
    const user = userEvent.setup();
    const patches = serveSettings(
      settings({ workspace: { id: "ws-1", name: "팀", role: "member" } }),
    );
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole("textbox", { name: "워크스페이스 이름" })).toBeDisabled();
    expect(screen.getByText("관리 권한이 있어야 바꿀 수 있어요")).toBeInTheDocument();
    const me = screen.getByRole("textbox", { name: "내 이름" });
    await user.clear(me);
    await user.type(me, "새 이름");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장했어요");
    expect(patches).toEqual([{ my_name: "새 이름" }]);
  });

  it("이름이 비어 있는 계정도 내 이름을 건드리지 않으면 워크스페이스 이름을 저장할 수 있다", async () => {
    const user = userEvent.setup();
    const patches = serveSettings(
      settings({ me: { id: 1, email: "maker@example.com", name: "" } }),
    );
    renderWithProviders(<SettingsPage />);

    const name = await screen.findByRole("textbox", { name: "워크스페이스 이름" });
    await user.type(name, " 2");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장했어요");
    expect(patches).toEqual([{ workspace_name: "My workspace 2" }]);
  });

  it("로그인하지 않았으면(401) 로그인이 필요하다고 안내한다", async () => {
    server.use(
      http.get("*/api/v1/workspace", () =>
        HttpResponse.json(
          { error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다.", fields: {} } },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "로그인이 필요해요" })).toBeInTheDocument();
  });
});
