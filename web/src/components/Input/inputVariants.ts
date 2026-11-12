/*
  Figma `Input` (P02 제품 URL, P04 계정, P05 메모·타겟) — 연회색 바탕 · 모서리 8 · 14px.
  Input·TextArea 가 같은 모양을 쓰므로 클래스를 한 곳에 둡니다.
  오류 칸은 빨간 1px 링, 초점을 받으면 빨간 2px 링 — 오류 상태에서도 초점 위치가 보이게 합니다.
*/
export const inputClass = [
  "w-full rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-ink placeholder:text-muted",
  "outline-none focus-visible:ring-2 focus-visible:ring-ink",
  "aria-invalid:ring-1 aria-invalid:ring-danger aria-invalid:focus-visible:ring-2",
  "disabled:cursor-not-allowed disabled:text-muted",
].join(" ");
