import type { RunDefaults } from "@/apis/workspace.api";

/*
  W04 실행 기본값 (보기 전용). 값은 BE run_defaults, 문구는 Figma 그대로입니다.
  비용 상한이 아직 정해지지 않았으면(null) Figma 문구 "실행당 상한 (값 확인 필요)" 를 둡니다.
*/
function executionDefaults(defaults: RunDefaults) {
  return [
    { label: "동시 세션", value: `최대 ${defaults.concurrency}` },
    { label: "요청 간격", value: `${defaults.request_interval_seconds}초 이상` },
    {
      label: "LLM 비용 상한",
      value:
        defaults.cost_cap == null ? "실행당 상한 (값 확인 필요)" : `실행당 $${defaults.cost_cap}`,
    },
    { label: "금지 동작", value: "실결제 · 실본인인증 · 실개인정보 입력" },
  ];
}

export default function ExecutionDefaults({ defaults }: { defaults: RunDefaults }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">실행 기본값</h2>
      <p className="text-caption text-subtle">
        모든 프로젝트에 같은 안전장치가 적용돼요. 바꿀 수 없어요
      </p>
      <dl>
        {executionDefaults(defaults).map((item) => (
          <div
            key={item.label}
            className="flex flex-wrap justify-between gap-3 border-b border-line py-4 text-sm last:border-0"
          >
            <dt className="text-subtle">{item.label}</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
