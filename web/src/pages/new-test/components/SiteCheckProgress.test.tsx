import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SiteCheckProgress from "./SiteCheckProgress";

describe("P02b 사이트 확인 중 상태 띠", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("단계 문구를 보여 주고, 지난 시간을 세다가 2분이 넘으면 오래 걸린다고 안내한다", () => {
    const { rerender } = render(<SiteCheckProgress phase="check" />);
    expect(screen.getByRole("status")).toHaveTextContent("사이트 주소에 접속하는 중이에요");
    expect(screen.getByText("0:00 지남 · 보통 1~2분 걸려요")).toBeInTheDocument();

    rerender(<SiteCheckProgress phase="discover" />);
    act(() => vi.advanceTimersByTime(42_000));
    expect(screen.getByRole("status")).toHaveTextContent("시작 화면의 메뉴와 기능을 읽는 중이에요");
    expect(screen.getByText("0:42 지남 · 보통 1~2분 걸려요")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(80_000));
    expect(screen.getByText("2:02 지남 · 평소보다 오래 걸려요")).toBeInTheDocument();
    expect(screen.getByText(/이 화면을 그대로 두면 이어서 진행돼요/)).toBeInTheDocument();
  });
});
