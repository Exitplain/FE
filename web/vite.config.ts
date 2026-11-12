import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4174";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      /*
        BE 개발 서버(agent.console)는 POST 요청의 Origin 이 자기 포트(localhost/127.0.0.1)가
        아니면 403 을 돌려준다. dev 서버가 대신 호출하면서 Origin 을 BE 주소로 바꿔 준다.
        mock 모드(VITE_USE_MOCK_API=true)에서는 MSW 가 먼저 요청을 가로챈다.
      */
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (proxyReq.getHeader("origin")) {
                proxyReq.setHeader("origin", new URL(proxyTarget).origin);
              }
            });
          },
        },
      },
    },
  };
});
