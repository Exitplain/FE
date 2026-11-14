import { useRef } from "react";

import { cn } from "@/utils/cn";

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  error: boolean;
  disabled: boolean;
};

export default function CodeInput({ value, onChange, error, disabled }: CodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // 빈 칸 위치를 유지해 가운데 숫자를 지워도 다른 칸이 앞으로 이동하지 않게 합니다.
  const digits = Array.from({ length: 6 }, (_, index) =>
    value[index] === " " ? "" : (value[index] ?? ""),
  );

  function update(index: number, digit: string) {
    const next = [...digits];
    next[index] = digit;
    onChange(next.map((item) => item || " ").join(""));
  }

  return (
    <div role="group" aria-label="6자리 인증 코드" className="grid grid-cols-6 gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          aria-label={`인증 코드 ${index + 1}번째 자리`}
          aria-invalid={error || undefined}
          aria-describedby={error ? "code-error" : undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          className={cn(
            "h-14.5 w-full min-w-0 rounded-xl border border-gray-300 bg-surface text-center text-xl font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink",
            error && "border-danger focus-visible:ring-danger",
          )}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, "").slice(-1);
            update(index, digit);
            if (digit) inputs.current[index + 1]?.focus();
          }}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              event.preventDefault();
              update(index - 1, "");
              inputs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowLeft") inputs.current[index - 1]?.focus();
            if (event.key === "ArrowRight") inputs.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 6 - index);
            if (!pasted) return;
            event.preventDefault();
            const next = [...digits];
            [...pasted].forEach((digit, offset) => {
              next[index + offset] = digit;
            });
            onChange(next.map((digit) => digit || " ").join(""));
            inputs.current[Math.min(index + pasted.length, 5)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
