import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("@theme 커스텀 토큰도 같은 종류끼리 뒤의 값으로 덮어쓴다", () => {
    expect(cn("rounded-lg", "rounded-tooltip")).toBe("rounded-tooltip");
    expect(cn("shadow-sm", "shadow-surface")).toBe("shadow-surface");
  });

  it("text-caption 을 글자 크기로 보고 글자 색(text-ink)은 남긴다", () => {
    expect(cn("text-ink text-sm", "text-caption")).toBe("text-ink text-caption");
  });
});
