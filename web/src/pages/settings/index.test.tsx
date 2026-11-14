import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { getWorkspaceSettings } from "@/apis/workspace.api";
import { renderWithProviders } from "@/test/renderWithProviders";

import SettingsPage from ".";

afterEach(() => sessionStorage.removeItem("exitplain-workspace-demo-settings"));

describe("워크스페이스 설정", () => {
  it("필수값을 검사하고 수정한 설정을 저장한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    const input = await screen.findByRole("textbox", { name: "워크스페이스 이름" });
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("워크스페이스 이름을 입력해 주세요")).toBeInTheDocument();
    await user.type(input, "팀 워크스페이스");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장했어요");
    expect((await getWorkspaceSettings()).workspaceName).toBe("팀 워크스페이스");
  });
});
