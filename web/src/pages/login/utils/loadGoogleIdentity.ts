const GSI_SRC = "https://accounts.google.com/gsi/client";
/* 응답 없이 멈춘 스크립트를 실패로 보고 다음에 다시 시도하게 하는 시간 */
const LOAD_TIMEOUT_MS = 10_000;

let loading: Promise<GoogleIdentity> | null = null;

/*
  Google Identity Services 스크립트를 한 번만 불러옵니다. 로그인 화면·모달에서만 필요해 index.html 에 넣지 않습니다.
  광고 차단·시간 초과로 실패하면 다음 호출에서 다시 시도할 수 있게 비웁니다.
*/
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (loading) return loading;

  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google);
      else fail();
    };
    script.onerror = fail;
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error("Google Identity Services 를 불러오지 못했습니다."));
    }
    document.head.appendChild(script);
  });
  return loading;
}

/*
  GSI 는 initialize 를 여러 번 부르면 경고를 남기므로 클라이언트 ID 별로 한 번만 부릅니다.
  credential 은 지금 화면에 있는 버튼 하나(setCredentialHandler)에 전달합니다.
  모달을 닫은 뒤 팝업에서 로그인을 마치면 받을 버튼이 없어 무시합니다.
*/
let initialized: { google: GoogleIdentity; clientId: string } | null = null;
let credentialHandler: ((credential: string) => void) | null = null;

export function initializeGoogleIdentity(google: GoogleIdentity, clientId: string) {
  if (initialized?.google === google && initialized.clientId === clientId) return;
  google.accounts.id.initialize({
    client_id: clientId,
    callback: ({ credential }) => {
      if (credential) credentialHandler?.(credential);
    },
  });
  initialized = { google, clientId };
}

/* 등록을 해제하는 함수를 돌려줍니다. 다른 버튼이 이미 바꿔 등록했으면 건드리지 않습니다 */
export function setCredentialHandler(handler: (credential: string) => void) {
  credentialHandler = handler;
  return () => {
    if (credentialHandler === handler) credentialHandler = null;
  };
}
