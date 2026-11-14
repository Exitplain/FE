import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TOAST_DURATION_MS, useToastStore } from "@/stores/useToastStore";

import ToastViewport from "./ToastViewport";

describe("ToastViewport", () => {
  afterEach(() => {
    vi.useRealTimers();
    useToastStore.setState({ toasts: [] });
  });

  it("알림을 status 영역에 보여주고 시간이 지나면 지운다", () => {
    vi.useFakeTimers();
    render(<ToastViewport />);

    act(() => {
      useToastStore.getState().show("링크를 복사했어요");
    });
    expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요");

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("여러 알림을 쌓고 하나씩 닫을 수 있다", () => {
    render(<ToastViewport />);

    let first = 0;
    act(() => {
      first = useToastStore.getState().show("첫 번째");
      useToastStore.getState().show("두 번째");
    });
    act(() => useToastStore.getState().dismiss(first));

    expect(screen.queryByText("첫 번째")).not.toBeInTheDocument();
    expect(screen.getByText("두 번째")).toBeInTheDocument();
  });
});
