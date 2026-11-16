/*
  개인정보처리방침 — 구글 로그인(OAuth) 공개 게시에 필요한 링크입니다 (https://exitplain.vercel.app/privacy).
  사이드바 하단 링크로 들어옵니다. 공통 레이아웃은 로그인하지 않아도 열려서 로그인 없이 볼 수 있습니다.
  문구는 BE에서 받은 내용 그대로입니다. 바꿀 때는 BE와 맞춰 주세요.
*/
const CONTACT_EMAIL = "exitplain@gmail.com";

const SECTIONS = [
  { title: "수집 항목", body: "이메일, 이름(구글 로그인 시 구글 계정 이름)" },
  { title: "수집 목적", body: "로그인과 서비스 이용자 확인" },
  { title: "보관 기간", body: "서비스 종료 또는 삭제 요청 시까지" },
  {
    title: "테스트 계정 비밀번호",
    body: "입력한 비밀번호는 암호화해서 저장하고, 화면에 다시 보여주지 않아요. 마지막으로 사용하거나 수정한 뒤 90일이 지나면 자동으로 삭제돼요.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-10 text-ink">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-base font-bold">{section.title}</h2>
          <p className="text-sm text-subtle">{section.body}</p>
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">문의</h2>
        <p className="text-sm text-subtle">
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  );
}
