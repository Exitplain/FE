import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PersonaAvatar from "./PersonaAvatar";
import { isPersonaAvatar } from "./personaAvatars";

describe("PersonaAvatar", () => {
  it("정해진 키면 연령대 캐릭터 이미지를 그린다", () => {
    const { container } = render(<PersonaAvatar avatar="50plus" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/personas/persona-50plus.svg",
    );
  });

  it("모르는 키·빈 값이면 아무것도 그리지 않는다 (임의 경로를 만들지 않음)", () => {
    for (const value of ["../../etc", "60s", "", null, undefined]) {
      const { container } = render(<PersonaAvatar avatar={value} />);
      expect(container.querySelector("img")).toBeNull();
    }
    expect(isPersonaAvatar("20s")).toBe(true);
  });
});
