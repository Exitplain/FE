import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Input from "@/components/Input/Input";
import TextArea from "@/components/TextArea/TextArea";

import Field from "./Field";

describe("Field", () => {
  it("라벨로 입력칸을 찾을 수 있다", () => {
    render(
      <Field label="제품 URL" hint="필수">
        {(control) => <Input {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText("제품 URL")).toBeInTheDocument();
    expect(screen.getByText("필수")).toBeInTheDocument();
  });

  it("도움말을 입력칸 설명으로 연결한다", () => {
    render(
      <Field label="타겟 고객 설명" help="자연어로 적어주세요">
        {(control) => <TextArea {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText("타겟 고객 설명")).toHaveAccessibleDescription(
      "자연어로 적어주세요",
    );
  });

  it("오류가 있으면 aria-invalid 와 오류 문구를 설명으로 붙인다", () => {
    render(
      <Field label="제품 URL" help="https:// 로 시작" error="입력을 확인해 주세요">
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText("제품 URL");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("https:// 로 시작 입력을 확인해 주세요");
  });

  it("입력값을 그대로 전달한다", async () => {
    const user = userEvent.setup();
    render(<Field label="메모">{(control) => <TextArea {...control} />}</Field>);

    await user.type(screen.getByLabelText("메모"), "쿠폰 적용");

    expect(screen.getByLabelText("메모")).toHaveValue("쿠폰 적용");
  });
});
