import { useEffect, useRef, useState } from "react";

import googleIcon from "@/assets/login/google.svg";
import Button from "@/components/Button/Button";
import { cn } from "@/utils/cn";

import {
  initializeGoogleIdentity,
  loadGoogleIdentity,
  setCredentialHandler,
} from "../utils/loadGoogleIdentity";

/* GSI 버튼 너비 한도(px) */
const MAX_WIDTH = 400;

/*
  Google 이 그려 주는 로그인 버튼입니다. 구글 정책상 버튼 모양·문구는 Google 렌더 버튼을 씁니다.
  불러오는 중이거나 쓸 수 없을 때(클라이언트 ID 없음, 스크립트 차단)는 Figma 버튼을 비활성으로 보여줍니다.
  Google 에 등록된 주소(http://localhost:5173)가 아니면 버튼을 눌렀을 때 Google 쪽에서 오류(origin_mismatch)를 띄우므로,
  등록되지 않은 배포 환경에는 VITE_GOOGLE_CLIENT_ID 를 넣지 않습니다.
*/
export default function GoogleLoginButton({
  onCredential,
}: {
  onCredential: (credential: string) => void;
}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latest.current = onCredential;
  });

  /* 화면에 있는 동안만 credential 을 받습니다 */
  useEffect(() => setCredentialHandler((credential) => latest.current(credential)), []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        const parent = container.current;
        if (cancelled || !parent) return;
        initializeGoogleIdentity(google, clientId);
        google.accounts.id.renderButton(parent, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          locale: "ko",
          width: Math.min(MAX_WIDTH, parent.offsetWidth || MAX_WIDTH),
        });
        setReady(true);
      })
      .catch(() => {
        /* 비활성 버튼을 그대로 둡니다. 이메일 로그인은 계속 쓸 수 있습니다 */
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      {/*
        그리기 전 너비를 재야 하므로 숨기지 않습니다. 비어 있는 동안은 높이가 0 입니다.
        GSI 버튼은 가장 큰 크기가 40px 이라, Figma 버튼 높이(50px) 칸 가운데에 두어 위아래 간격을 맞춥니다.
      */}
      <div
        ref={container}
        data-testid="google-login-button"
        className={cn("flex justify-center", ready && "h-12.5 items-center")}
      />
      {!ready && (
        <Button
          variant="secondary"
          disabled
          className="h-12.5 w-full gap-2 rounded-full border border-gray-300 text-sm"
        >
          <img src={googleIcon} alt="" className="size-5 shrink-0" />
          Google로 계속하기
        </Button>
      )}
    </div>
  );
}
