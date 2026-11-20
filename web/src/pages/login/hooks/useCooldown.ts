import { useCallback, useEffect, useRef, useState } from "react";

/*
  초 단위 카운트다운. 코드 재전송 대기(429 RESEND_TOO_SOON)에 씁니다.
  끝나는 시각을 기준으로 남은 초를 다시 계산해, 타이머가 밀리거나 탭이 백그라운드여도 어긋나지 않습니다.
*/
export function useCooldown() {
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(timer);
  }, [active]);

  const start = useCallback((seconds: number) => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  return { remaining, start };
}
