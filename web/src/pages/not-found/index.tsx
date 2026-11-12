import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="py-20 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
        대시보드로 돌아가기
      </Link>
    </section>
  );
}
