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

  it("진행 사건이 없으면 자세히 보기를 두지 않는다 (이전 BE)", () => {
    render(<SiteCheckProgress phase="discover" />);
    expect(screen.queryByRole("button", { name: /자세히 보기/ })).not.toBeInTheDocument();
  });

  it("마지막 사건 한 줄을 보여 주고, 자세히 보기로 전체 기록을 펼치고 접는다", () => {
    const events = [
      { seq: 1, t: 0, kind: "queued", message: "사이트 확인을 시작했어요" },
      {
        seq: 2,
        t: 24.3,
        kind: "write_blocked",
        message: "POST /api/save 요청은 막았어요",
        path: "/api/save",
      },
      {
        seq: 3,
        t: 29,
        kind: "page_read",
        message: "'노트' 화면을 읽었어요 · 같은 사이트 링크 3개",
        path: "/notes",
      },
    ];
    render(<SiteCheckProgress phase="discover" events={events} />);
    expect(screen.getByText("'노트' 화면을 읽었어요 · 같은 사이트 링크 3개")).toBeInTheDocument();
    expect(screen.queryByText("사이트 확인을 시작했어요")).not.toBeInTheDocument();
    /* 사건 문구는 상태 안내(role=status)에 섞이지 않습니다 */
    expect(screen.getByRole("status")).toHaveTextContent(
      /^시작 화면의 메뉴와 기능을 읽는 중이에요$/,
    );

    const toggle = screen.getByRole("button", { name: /자세히 보기/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    act(() => toggle.click());
    const list = screen.getByRole("list", { name: "사이트 확인 기록" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(list).toHaveTextContent("0:24차단POST /api/save 요청은 막았어요");

    act(() => screen.getByRole("button", { name: /접기/ }).click());
    expect(screen.queryByRole("list", { name: "사이트 확인 기록" })).not.toBeInTheDocument();
  });
});
