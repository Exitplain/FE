import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import LoginPage from ".";

describe("로그인 오류와 재시도", () => {
  it("오류 뒤에도 입력한 이메일을 유지하고 재시도로 인증 코드 화면에 이동한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login?simulate=network-error" });

    await user.type(screen.getByRole("textbox", { name: "이메일 주소" }), "test@example.com");
    await user.click(screen.getByRole("button", { name: "계속" }));

    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 연결을 확인하고 다시 시도하세요");
    expect(screen.getByRole("textbox", { name: "이메일 주소" })).toHaveValue("test@example.com");

    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이메일을 확인하세요" })).toBeInTheDocument();
    expect(screen.getByText(/test@example.com으로 보낸/)).toBeInTheDocument();
  });

  it("일반 로그인에서는 입력 없이 다음 화면에 이동한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });
    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.getByRole("heading", { name: "이메일을 확인하세요" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
