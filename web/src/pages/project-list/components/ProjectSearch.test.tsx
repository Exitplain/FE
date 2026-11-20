import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import ProjectSearch from "./ProjectSearch";

function SearchHarness({ onCommit }: { onCommit: (value: string) => void }) {
  const [params, setParams] = useSearchParams();
  return (
    <>
      <ProjectSearch
        value={params.get("q") ?? ""}
        onChange={(value) => {
          onCommit(value);
          setParams({ q: value }, { replace: true });
        }}
        onClear={() => setParams({})}
      />
      <output aria-label="검색 URL">{params.toString()}</output>
      <button onClick={() => setParams({ q: "studio" })}>외부 검색 변경</button>
    </>
  );
}

describe("프로젝트 검색 입력", () => {
  it("URL 반영이 늦어도 이정능의 중간 글자와 다음 조합을 유지한다", () => {
    const onChange = vi.fn();
    const props = { onChange, onClear: vi.fn() };
    const { rerender } = render(<ProjectSearch {...props} value="" />);
    const input = screen.getByRole("textbox");
    for (const text of ["이", "이정", "이정능"]) {
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: text } });
      fireEvent.compositionEnd(input, { data: text.slice(-1) });
      // The router has not reflected the completed syllable yet.
      expect(input).toHaveValue(text);
      if (text === "이정") {
        rerender(<ProjectSearch {...props} value="이" />);
        expect(input).toHaveValue("이정");
      }
    }
    rerender(<ProjectSearch {...props} value="이정" />);
    expect(input).toHaveValue("이정능");
    rerender(<ProjectSearch {...props} value="이정능" />);
    expect(input).toHaveValue("이정능");
    expect(onChange.mock.calls).toEqual([["이"], ["이정"], ["이정능"]]);
  });

  it("한글 조합 중에도 검색을 갱신하고 마지막 입력 이벤트는 중복 반영하지 않는다", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    renderWithProviders(<SearchHarness onCommit={onCommit} />);
    const input = screen.getByRole("textbox");
    await user.click(input);

    for (const [draft, completed] of [
      ["ㅂ", "반"],
      ["반ㅊ", "반찬"],
    ]) {
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: draft } });
      expect(input).toHaveValue(draft);
      expect(screen.getByLabelText("검색 URL")).toHaveTextContent(
        new URLSearchParams({ q: draft }).toString(),
      );
      fireEvent.change(input, { target: { value: completed } });
      expect(onCommit).toHaveBeenCalledTimes(completed === "반" ? 2 : 4);
      fireEvent.compositionEnd(input, { data: completed });
      // Browsers may dispatch a final input event after compositionend.
      fireEvent.input(input, { target: { value: completed }, isComposing: false });
      expect(input).toHaveValue(completed);
      expect(input).toHaveFocus();
      expect(screen.getByLabelText("검색 URL")).toHaveTextContent(
        new URLSearchParams({ q: completed }).toString(),
      );
    }
    expect(onCommit.mock.calls).toEqual([["ㅂ"], ["반"], ["반ㅊ"], ["반찬"]]);
    await user.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(input).toHaveValue("");
    expect(screen.getByLabelText("검색 URL")).toBeEmptyDOMElement();
  });

  it("일반 입력과 외부 URL 변경을 검색창에 반영한다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness onCommit={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "phone");
    expect(input).toHaveValue("phone");
    expect(screen.getByLabelText("검색 URL")).toHaveTextContent("q=phone");
    await user.click(screen.getByRole("button", { name: "외부 검색 변경" }));
    expect(input).toHaveValue("studio");
  });
});
