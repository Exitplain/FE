import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Button from "@/components/Button/Button";

import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("제목·설명·행동 버튼을 보여준다", () => {
    render(
      <EmptyState
        icon="play"
        title="아직 사전 테스트가 없어요"
        description="AI 고객 20명이 어디서 왜 떠나는지 알려줘요"
        action={<Button>새 테스트 시작하기</Button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "아직 사전 테스트가 없어요" })).toBeInTheDocument();
    expect(screen.getByText("AI 고객 20명이 어디서 왜 떠나는지 알려줘요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 테스트 시작하기" })).toBeInTheDocument();
  });

  it("제목 단계를 바꿀 수 있다", () => {
    render(<EmptyState icon="play" title="결과 없음" headingLevel={3} />);

    expect(screen.getByRole("heading", { level: 3, name: "결과 없음" })).toBeInTheDocument();
  });
});
