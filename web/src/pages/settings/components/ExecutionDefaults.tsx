const defaults = [
  { label: "동시 세션", value: "최대 5" },
  { label: "요청 간격", value: "1초 이상" },
  { label: "LLM 비용 상한", value: "실행당 상한 (값 확인 필요)" },
  { label: "금지 동작", value: "실결제 · 실본인인증 · 실개인정보 입력" },
];

export default function ExecutionDefaults() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">실행 기본값</h2>
      <p className="text-caption text-subtle">
        모든 프로젝트에 같은 안전장치가 적용돼요. 바꿀 수 없어요
      </p>
      <dl>
        {defaults.map((item) => (
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
