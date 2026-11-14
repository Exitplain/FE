import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

beforeEach(() => useDemoSessionStore.getState().signOut());

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

describe("사이드바 데모 로그인", () => {
  it("로그인 모달을 닫으면 원래 주소와 입력을 유지한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppLayout />
        <LocationProbe />
        <input aria-label="작업 메모" />
      </>,
      { route: "/projects/banchan/tests?filter=running" },
    );
    await user.type(screen.getByRole("textbox", { name: "작업 메모" }), "작성 중");
    await user.click(screen.getByRole("button", { name: "로그인" }));
    expect(screen.getByRole("dialog", { name: "로그인 또는 회원가입" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "로그인 창 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent(
      "/projects/banchan/tests?filter=running",
    );
    expect(screen.getByRole("textbox", { name: "작업 메모" })).toHaveValue("작성 중");
  });

  it("입력 없이 로그인하고 계정 메뉴에서 로그아웃한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppLayout />
        <LocationProbe />
      </>,
      { route: "/history" },
    );
    await user.click(screen.getByRole("button", { name: "로그인" }));
    await user.click(screen.getByRole("button", { name: "계속" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "로그인" }));
    const account = await screen.findByRole("button", { name: "메이커 계정 메뉴" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/history");
    await user.click(account);
    expect(screen.getByRole("link", { name: "워크스페이스 설정" })).toHaveAttribute(
      "href",
      "/settings",
    );
    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
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
