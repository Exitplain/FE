import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/*
  테스트마다 새 QueryClient 를 만들어 캐시가 다른 테스트로 새지 않게 합니다.
  retry 를 끄는 이유: 실패 응답 테스트가 재시도 때문에 늦게 끝나거나 응답이 섞이지 않게.
*/
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, "wrapper"> & {
  /* 처음 열 주소. 예: "/projects/banchan/tests" */
  route?: string;
  /*
    useParams 가 필요하면 라우트 패턴을 함께 넘깁니다. 예: "/projects/:projectId/tests"
    없으면 Routes 없이 렌더링하므로 useParams 는 빈 객체입니다.
  */
  path?: string;
  queryClient?: QueryClient;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path, queryClient = createTestQueryClient(), ...options }: Options = {},
) {
  return {
    queryClient,
    ...render(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            {path ? (
              <Routes>
                <Route path={path} element={children} />
              </Routes>
            ) : (
              children
            )}
          </MemoryRouter>
        </QueryClientProvider>
      ),
      ...options,
    }),
  };
}
