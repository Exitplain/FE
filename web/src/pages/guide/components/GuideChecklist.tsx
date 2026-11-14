import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/Button/buttonVariants";
import Icon from "@/components/Icon/Icon";
import { buildPath } from "@/constants/routes";

const steps = [
  { title: "프로젝트 만들기", description: "진단할 사이트 1개 = 프로젝트 1개", done: true },
  {
    title: "첫 사전 테스트 실행",
    description: "목표·타겟을 넣으면 페르소나 20명이 사이트를 써봐요",
    done: true,
  },
  { title: "리포트 확인", description: "어디서·왜 이탈하는지 범위로 보여줘요", done: true },
  {
    title: "실측 스크립트 설치",
    description: "실제 사용자의 퍼널 단계만 익명으로 모아요",
    done: false,
  },
  {
    title: "예측 vs 실측 비교 → 보정",
    description: "차이를 확인하고 이 사이트에 맞게 예측을 보정해요",
    done: false,
  },
];

export default function GuideChecklist() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">진단 루프 시작하기</h2>
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-wrap items-center gap-4 border-b border-line py-4 last:border-0"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-caption ${step.done ? "border-ink" : index === 3 ? "border-muted bg-muted text-surface" : "border-gray-300 text-muted"}`}
            >
              {step.done ? <Icon name="check" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={`text-sm ${index === 4 ? "text-muted" : "font-bold"}`}>
                {step.title}
              </h3>
              <p className="mt-1 text-caption text-subtle">{step.description}</p>
            </div>
            {step.done ? (
              <span className="text-sm">완료</span>
            ) : index === 3 ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                to={buildPath("analytics", { projectId: "banchan" })}
              >
                실측 데이터 연결하기
              </Link>
            ) : (
              <span className="text-sm text-muted">다음 단계</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
