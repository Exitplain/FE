/*
  P02 "어떻게 테스트할까요?" (Figma 시안 C 보완) — 배포된 URL / 코드만 있어요.
  카드를 고르면 같은 화면에서 그 방식의 입력이 바로 아래에 펼쳐집니다 ("계속" 단계 없음).
  라디오 그룹이라 화살표 키로도 고를 수 있습니다.
*/
const OPTIONS = [
  { value: "url", title: "배포된 URL이 있어요", description: "실제 주소로 접속해 화면을 둘러봐요" },
  { value: "code", title: "코드만 있어요", description: "zip·공개 git 으로 받아 코드를 읽어요" },
] as const;

export default function InputModeCards({
  value,
  disabled,
  onChange,
}: {
  value: "url" | "code";
  disabled?: boolean;
  onChange: (value: "url" | "code") => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3" disabled={disabled}>
      <legend className="sr-only">테스트 방식</legend>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl bg-white px-5 py-4 ${
              selected ? "border-2 border-ink" : "border border-gray-200 hover:border-gray-300"
            } has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2`}
          >
            <input
              type="radio"
              name="input-mode"
              className="size-5 shrink-0 accent-ink"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">{option.title}</span>
              <span className="text-xs text-muted">{option.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
