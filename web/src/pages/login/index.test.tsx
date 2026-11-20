import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/apis/queryKeys";
import { buildPath } from "@/constants/routes";
import { server, TEST_CSRF_TOKEN } from "@/mocks/node";
import { useDemoSessionStore } from "@/stores/useDemoSessionStore";
import { renderWithProviders } from "@/test/renderWithProviders";

import LoginPage from ".";

const SESSION = {
  authenticated: true,
  user: { id: 1, email: "test@example.com", name: "테스터" },
  workspace: { id: 1, name: "테스트 워크스페이스" },
  session_expires_at: "2026-12-01T00:00:00Z",
};

function productError(status: number, code: string, message: string, fields = {}) {
  return HttpResponse.json(
    { error: { code, message, fields }, request_id: "req_test" },
    { status },
  );
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <output aria-label="현재 주소">{pathname}</output>;
}

function renderLogin() {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <>
      <LoginPage />
      <LocationProbe />
    </>,
    { route: "/login" },
  );
  return { user, ...view };
}

async function submitEmail(user: ReturnType<typeof userEvent.setup>, email = "test@example.com") {
  await user.type(screen.getByRole("textbox", { name: "이메일 주소" }), email);
  await user.click(screen.getByRole("button", { name: "계속" }));
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole("textbox", { name: "인증 코드 1번째 자리" }));
  await user.paste(code);
}

beforeEach(() => {
  // 구글 버튼은 따로 검증하므로 기본은 클라이언트 ID 없이(비활성 버튼) 렌더링합니다
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  useDemoSessionStore.getState().signOut();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
});

describe("이메일 코드 로그인", () => {
  it("코드를 요청하고, 공백 없는 6자리로 확인한 뒤 대시보드로 이동한다", async () => {
    const requests: unknown[] = [];
    let csrfHeader: string | null = null;
    server.use(
      http.post("*/api/v1/auth/email/request", async ({ request }) => {
        csrfHeader = request.headers.get("X-CSRFToken");
        requests.push(await request.json());
        return new HttpResponse(null, { status: 202 });
      }),
      http.post("*/api/v1/auth/email/verify", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json(SESSION);
      }),
    );
    const { user, queryClient } = renderLogin();

    await submitEmail(user, "  test@example.com ");
    expect(await screen.findByRole("heading", { name: "이메일을 확인하세요" })).toBeInTheDocument();
    expect(
      screen.getByText("test@example.com으로 보낸 6자리 코드를 입력하세요"),
    ).toBeInTheDocument();

    await enterCode(user, "482917");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByLabelText("현재 주소")).toHaveTextContent(buildPath("dashboard"));
    expect(requests).toEqual([
      { email: "test@example.com" },
      { email: "test@example.com", code: "482917" },
    ]);
    expect(csrfHeader).toBe(TEST_CSRF_TOKEN);
    expect(queryClient.getQueryData(queryKeys.auth.session())).toEqual(SESSION);
    expect(useDemoSessionStore.getState().account).toEqual({
      name: "테스터",
      email: "test@example.com",
    });
  });

  it("6자리를 다 입력하기 전에는 코드를 확인하지 않는다", async () => {
    const verify = vi.fn();
    server.use(
      http.post("*/api/v1/auth/email/request", () => new HttpResponse(null, { status: 202 })),
      http.post("*/api/v1/auth/email/verify", () => {
        verify();
        return HttpResponse.json(SESSION);
      }),
    );
    const { user } = renderLogin();
    await submitEmail(user);
    await screen.findByRole("heading", { name: "이메일을 확인하세요" });

    await enterCode(user, "48");
    await user.click(screen.getByRole("button", { name: "로그인" }));
    expect(verify).not.toHaveBeenCalled();
  });

  it("네트워크 오류면 Figma 안내를 보여주고 입력한 이메일을 유지한다", async () => {
    server.use(http.post("*/api/v1/auth/email/request", () => HttpResponse.error()));
    const { user } = renderLogin();

    await submitEmail(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "로그인하지 못했어요 · 네트워크 연결을 확인하고 다시 시도하세요",
    );
    expect(screen.getByRole("textbox", { name: "이메일 주소" })).toHaveValue("test@example.com");
  });

  it("메일 발송 실패(503)면 서버 안내를 보여주고 바로 다시 요청할 수 있다", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/v1/auth/email/request", () => {
        calls += 1;
        return calls === 1
          ? productError(
              503,
              "EMAIL_SEND_FAILED",
              "메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
            )
          : new HttpResponse(null, { status: 202 });
      }),
    );
    const { user } = renderLogin();

    await submitEmail(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 뒤 다시 시도해 주세요");
    expect(screen.getByRole("button", { name: "계속" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(await screen.findByRole("heading", { name: "이메일을 확인하세요" })).toBeInTheDocument();
  });

  it("너무 빨리 재요청(429)하면 코드 화면에서 남은 시간을 보여주고 재전송을 막는다", async () => {
    server.use(
      http.post("*/api/v1/auth/email/request", () =>
        productError(429, "RESEND_TOO_SOON", "잠시 뒤 다시 요청해 주세요.", { retry_after: 42 }),
      ),
    );
    const { user } = renderLogin();

    await submitEmail(user);

    const resend = await screen.findByRole("button", { name: "0:42 후 ·코드 재전송" });
    expect(resend).toBeDisabled();
    expect(
      screen.getByText("test@example.com으로 보낸 6자리 코드를 입력하세요"),
    ).toBeInTheDocument();
  });

  it("코드가 틀리면 Figma 문구를 보여주고 입력한 코드를 유지한다", async () => {
    server.use(
      http.post("*/api/v1/auth/email/request", () => new HttpResponse(null, { status: 202 })),
      http.post("*/api/v1/auth/email/verify", () =>
        productError(400, "CODE_INVALID", "코드가 올바르지 않습니다.", { remaining_attempts: 4 }),
      ),
    );
    const { user } = renderLogin();
    await submitEmail(user);
    await screen.findByRole("heading", { name: "이메일을 확인하세요" });

    await enterCode(user, "482910");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "코드가 맞지 않습니다. 다시 한번 입력해 주세요",
    );
    expect(screen.getByRole("textbox", { name: "인증 코드 6번째 자리" })).toHaveValue("0");
  });

  it("코드가 만료되면 서버 안내를 보여주고, 재전송하면 입력을 비운다", async () => {
    server.use(
      http.post("*/api/v1/auth/email/request", () => new HttpResponse(null, { status: 202 })),
      http.post("*/api/v1/auth/email/verify", () =>
        productError(400, "CODE_EXPIRED", "코드가 만료되었습니다. 새 코드를 요청해 주세요."),
      ),
    );
    const { user } = renderLogin();
    await submitEmail(user);
    await screen.findByRole("heading", { name: "이메일을 확인하세요" });
    await enterCode(user, "482910");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("코드가 만료되었습니다");

    await user.click(screen.getByRole("button", { name: "코드 재전송" }));
    expect(await screen.findByText("코드를 다시 보냈어요")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "인증 코드 1번째 자리" })).toHaveValue("");
  });

  it("재전송이 실패하면 안내만 보여주고 입력칸을 오류로 표시하지 않는다", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/v1/auth/email/request", () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 202 })
          : productError(503, "EMAIL_SEND_FAILED", "메일을 보내지 못했습니다.");
      }),
    );
    const { user } = renderLogin();
    await submitEmail(user);
    await screen.findByRole("heading", { name: "이메일을 확인하세요" });

    await user.click(screen.getByRole("button", { name: "코드 재전송" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("메일을 보내지 못했습니다.");
    expect(screen.getByRole("textbox", { name: "인증 코드 1번째 자리" })).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByText("코드가 아직 안왔나요?")).toBeInTheDocument();
  });

  it("세션 만료 안내에서 다시 로그인하면 주소의 view 를 지운다", async () => {
    const user = userEvent.setup();
    function SearchProbe() {
      return <output aria-label="검색어">{useLocation().search}</output>;
    }
    renderWithProviders(
      <>
        <LoginPage />
        <SearchProbe />
      </>,
      { route: "/login?view=expired" },
    );

    await user.click(screen.getByRole("button", { name: "다시 로그인" }));

    expect(screen.getByRole("heading", { name: "로그인 또는 회원가입" })).toBeInTheDocument();
    expect(screen.getByLabelText("검색어")).toBeEmptyDOMElement();
  });
});

describe("구글 로그인", () => {
  function stubGoogle() {
    let callback: ((response: { credential?: string }) => void) | undefined;
    const renderButton = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize: (config) => {
            callback = config.callback;
          },
          renderButton,
        },
      },
    };
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id");
    return { renderButton, sendCredential: (credential: string) => callback?.({ credential }) };
  }

  it("Google 이 준 credential 을 id_token 으로 보내고 대시보드로 이동한다", async () => {
    let body: unknown;
    server.use(
      http.post("*/api/v1/auth/google", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(SESSION);
      }),
    );
    const google = stubGoogle();
    renderLogin();

    await vi.waitFor(() => expect(google.renderButton).toHaveBeenCalled());
    expect(screen.getByTestId("google-login-button")).toBe(google.renderButton.mock.calls[0][0]);
    google.sendCredential("google-id-token");

    expect(await screen.findByLabelText("현재 주소")).toHaveTextContent(buildPath("dashboard"));
    expect(body).toEqual({ id_token: "google-id-token" });
  });

  it("토큰이 유효하지 않으면 서버 안내를 보여준다", async () => {
    server.use(
      http.post("*/api/v1/auth/google", () =>
        productError(400, "GOOGLE_TOKEN_INVALID", "Google 토큰을 확인하지 못했습니다."),
      ),
    );
    const google = stubGoogle();
    renderLogin();
    await vi.waitFor(() => expect(google.renderButton).toHaveBeenCalled());

    google.sendCredential("bad-token");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google 토큰을 확인하지 못했습니다.",
    );
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/login");
  });

  it("클라이언트 ID 가 없으면 Figma 버튼을 비활성으로 보여준다", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeDisabled();
  });
});
