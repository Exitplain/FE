/*
  Google Identity Services(https://accounts.google.com/gsi/client) 중 로그인 버튼에 쓰는 부분만 적은 타입입니다.
  스크립트는 pages/login/utils/loadGoogleIdentity.ts 가 로그인 화면에서만 불러옵니다.
*/
type GoogleCredentialResponse = { credential?: string };

type GoogleButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
    };
  };
};

interface Window {
  google?: GoogleIdentity;
}
