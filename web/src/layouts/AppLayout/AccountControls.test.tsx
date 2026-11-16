import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/node";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { renderWithProviders } from "@/test/renderWithProviders";

import AppLayout from "./AppLayout";

function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <output aria-label="현재 주소">
      {pathname}
      {search}
    </output>
  );
}

beforeEach(() => {
  // 로컬 .env 의 클라이언트 ID 와 상관없이 같은 경로(구글 버튼 비활성)로 렌더링합니다
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  useDemoSessionStore.getState().signOut();
});
afterEach(() => vi.unstubAllEnvs());

// jsdom에는 top-layer dialog API가 없어 열림·닫힘만 보완합니다.
// 실제 브라우저의 Tab 초점 가두기와 배경 차단은 이 테스트의 검증 대상이 아닙니다.
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  useDemoSessionStore.getState().signOut();
});

describe("사이드바 로그인", () => {
  it("로그인 모달을 닫으면 원래 주소와 입력을 유지한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppLayout />
        <LocationProbe />
        <input aria-label="작업 메모" />
      </>,
      { route: "/projects/1/tests?filter=running" },
    );
    await user.type(screen.getByRole("textbox", { name: "작업 메모" }), "작성 중");
    await user.click(screen.getByRole("button", { name: "로그인" }));
    expect(screen.getByRole("dialog", { name: "로그인 또는 회원가입" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "로그인 창 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent(
      "/projects/1/tests?filter=running",
    );
    expect(screen.getByRole("textbox", { name: "작업 메모" })).toHaveValue("작성 중");
  });

  it("모달에서 이메일 코드로 로그인하고 계정 메뉴에서 로그아웃한다", async () => {
    const logout = vi.fn();
    server.use(
      http.post("*/api/v1/auth/email/request", () => new HttpResponse(null, { status: 202 })),
      http.post("*/api/v1/auth/email/verify", () =>
        HttpResponse.json({
          authenticated: true,
          user: { id: 1, email: "maker@example.com", name: "메이커" },
          workspace: { id: 1, name: "메이커 워크스페이스" },
          session_expires_at: "2026-12-01T00:00:00Z",
        }),
      ),
      http.post("*/api/v1/auth/logout", () => {
        logout();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppLayout />
        <LocationProbe />
      </>,
      { route: "/history" },
    );
    await user.click(screen.getByRole("button", { name: "로그인" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: "이메일 주소" }),
      "maker@example.com",
    );
    await user.click(within(dialog).getByRole("button", { name: "계속" }));
    await user.click(await within(dialog).findByRole("textbox", { name: "인증 코드 1번째 자리" }));
    await user.paste("123456");
    await user.click(within(dialog).getByRole("button", { name: "로그인" }));
    const account = await screen.findByRole("button", { name: "메이커 계정 메뉴" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/history");
    await user.click(account);
    expect(screen.getByRole("link", { name: "워크스페이스 설정" })).toHaveAttribute(
      "href",
      "/settings",
    );
    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(logout).toHaveBeenCalledOnce();
    expect(useDemoSessionStore.getState().account).toBeNull();
  });

  it("응답 전에 모달을 닫아도 로그인이 끝나면 계정을 보여준다", async () => {
    let respond: () => void = () => {};
    server.use(
      http.post("*/api/v1/auth/email/request", () => new HttpResponse(null, { status: 202 })),
      http.post(
        "*/api/v1/auth/email/verify",
        () =>
          new Promise<Response>((resolve) => {
            respond = () =>
              resolve(
                HttpResponse.json({
                  authenticated: true,
                  user: { id: 1, email: "maker@example.com", name: "메이커" },
                  workspace: { id: 1, name: "메이커 워크스페이스" },
                  session_expires_at: "2026-12-01T00:00:00Z",
                }),
              );
          }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AppLayout />);
    await user.click(screen.getByRole("button", { name: "로그인" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: "이메일 주소" }),
      "maker@example.com",
    );
    await user.click(within(dialog).getByRole("button", { name: "계속" }));
    await user.click(await within(dialog).findByRole("textbox", { name: "인증 코드 1번째 자리" }));
    await user.paste("123456");
    await user.click(within(dialog).getByRole("button", { name: "로그인" }));
    await vi.waitFor(() => expect(within(dialog).getByText("로그인 중…")).toBeInTheDocument());

    await user.click(within(dialog).getByRole("button", { name: "로그인 창 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    respond();

    expect(await screen.findByRole("button", { name: "메이커 계정 메뉴" })).toBeInTheDocument();
  });

  it("서버 세션이 로그인 상태면 들어올 때 계정을 보여준다", async () => {
    server.use(
      http.get("*/api/v1/auth/session", () =>
        HttpResponse.json({
          authenticated: true,
          user: { id: 1, email: "kim@example.com", name: null },
          workspace: { id: 1, name: "워크스페이스" },
          session_expires_at: "2026-12-01T00:00:00Z",
        }),
      ),
    );
    renderWithProviders(<AppLayout />);
    expect(await screen.findByRole("button", { name: "kim 계정 메뉴" })).toBeInTheDocument();
  });

  it("남아 있던 계정 표시는 서버 세션이 비로그인이면 지운다", async () => {
    useDemoSessionStore.getState().setAccount({ name: "메이커", email: "maker@example.com" });
    renderWithProviders(<AppLayout />);
    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(useDemoSessionStore.getState().account).toBeNull();
  });

  it("세션 만료 안내에서 다시 로그인 모달을 열고 Escape로 닫는다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppLayout />);
    act(() => useDemoSessionStore.getState().expire());
    expect(screen.getByRole("dialog", { name: "세션 만료" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 로그인" }));
    expect(screen.getByRole("dialog", { name: "로그인 또는 회원가입" })).toBeInTheDocument();
    // jsdom은 Escape의 네이티브 cancel 이벤트를 발생시키지 않으므로 이벤트를 직접 전달합니다.
    const dialog = screen.getByRole("dialog");
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
