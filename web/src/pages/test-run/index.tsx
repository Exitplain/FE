import PagePlaceholder from "@/components/PagePlaceholder/PagePlaceholder";

/*
  실행 상태 조회는 @/hooks/usePersonaRun 을 사용합니다. (polling 예시)
  화면 구현을 시작하면 PagePlaceholder 를 지웁니다.
*/
export default function TestRunPage() {
  return <PagePlaceholder routeKey="testRun" />;
}
