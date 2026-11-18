import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants/routes";
import { seedParticipantLink } from "@/mocks/handlers/participant";
import { renderWithProviders } from "@/test/renderWithProviders";

import ParticipantPage from "./index";

function renderParticipant(token: string) {
  return renderWithProviders(<ParticipantPage />, {
    route: `/r/${token}`,
    path: ROUTES.participant.path,
  });
}

describe("참여자 응답 링크 (PART-02·03)", () => {
  it("로그인 없이 사이트를 열고, 누르기만 해서 답하면 감사 화면을 보여준다", async () => {
    const user = userEvent.setup();
    renderParticipant(seedParticipantLink("101"));

    expect(
      await screen.findByRole("heading", { name: "“첫 주문 완료”을 해 주세요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "사이트 열기 ↗" })).toHaveAttribute(
      "href",
      "https://banchanroad-demo.vercel.app/?variant=problem&case=all",
    );
    /* 글자를 쓰는 칸이 없다 */
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const send = screen.getByRole("button", { name: "응답 보내기" });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "끝까지 했어요" }));
    await user.click(screen.getByRole("radio", { name: "장바구니" }));
    await user.click(screen.getByRole("radio", { name: "생각보다 비싸거나 갑자기 돈이 붙었어요" }));
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.click(send);

    expect(
      await screen.findByRole("heading", { name: "참여해 주셔서 감사해요" }),
    ).toBeInTheDocument();
  });

  it("그만뒀다면 그만둔 화면을 꼭 고르게 하고, '특별히 없었어요'는 숨긴다", async () => {
    const user = userEvent.setup();
    renderParticipant(seedParticipantLink("101"));

    await user.click(await screen.findByRole("radio", { name: "중간에 그만뒀어요" }));
    expect(
      screen.getByRole("heading", { name: "2. 어느 화면에서 그만뒀나요?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "특별히 없었어요" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "5" }));
    expect(screen.getByRole("button", { name: "응답 보내기" })).toBeDisabled();
  });

  it("같은 브라우저에서 두 번 보내면 이미 답했다고 알린다", async () => {
    const user = userEvent.setup();
    const token = seedParticipantLink("101");
    const answer = async () => {
      await user.click(await screen.findByRole("radio", { name: "끝까지 했어요" }));
      await user.click(screen.getByRole("radio", { name: "특별히 없었어요" }));
      await user.click(screen.getByRole("radio", { name: "1" }));
      await user.click(screen.getByRole("button", { name: "응답 보내기" }));
    };
    const first = renderParticipant(token);
    await answer();
    await screen.findByRole("heading", { name: "참여해 주셔서 감사해요" });
    first.unmount();

    renderParticipant(token);
    await answer();
    expect(await screen.findByText("이미 답해 주셨어요. 감사해요!")).toBeInTheDocument();
  });

  it("없는 링크는 열 수 없다고 알린다", async () => {
    renderParticipant("nope");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
