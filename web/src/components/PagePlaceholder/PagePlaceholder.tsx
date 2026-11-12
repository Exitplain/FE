import { FIGMA_FILE_URL, ROUTES, type RouteKey } from "@/constants/routes";

/*
  아직 구현하지 않은 화면의 자리 표시.
  담당자가 화면을 만들기 시작하면 해당 pages/<화면>/index.tsx 에서 이 컴포넌트를 지웁니다.
*/
export default function PagePlaceholder({ routeKey }: { routeKey: RouteKey }) {
  const route = ROUTES[routeKey];

  return (
    <section className="rounded-xl border border-dashed border-gray-400 bg-surface p-8">
      <p className="text-sm text-muted">{route.screens}</p>
      <h1 className="mt-1 text-2xl font-bold">{route.title}</h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">경로</dt>
        <dd>
          <code>{route.path}</code>
        </dd>
      </dl>
      <a
        className="mt-6 inline-block text-sm underline underline-offset-4"
        href={FIGMA_FILE_URL}
        target="_blank"
        rel="noreferrer"
      >
        Figma 와이어프레임 열기
      </a>
    </section>
  );
}
