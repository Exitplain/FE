import { cva } from "class-variance-authority";

import Icon from "@/components/Icon/Icon";
import type { IconName } from "@/components/Icon/iconNames";
import { cn } from "@/utils/cn";

/*
  Figma `DS/Status/테스트`(P01) · 세션 타일 상태(P09) — 20px 아이콘 + 13px 글자.

  | tone   | 모양                              | 예                          |
  | ------ | --------------------------------- | --------------------------- |
  | muted  | 연회색 pill · 보조 글자            | 준비 중, 완료, 대기           |
  | strong | 배경 없음 · 굵은 검정              | 실행 중, 진행 중              |
  | alert  | 빨간 아이콘 · 굵은 검정 글자        | 실패 (P01 목록)              |
  | danger | 빨간 아이콘 · 빨간 굵은 글자        | 이탈 (P09 세션 타일)          |
*/
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full py-1 text-caption", {
  variants: {
    tone: {
      muted: "bg-gray-50 px-3 text-subtle",
      strong: "px-3 font-bold text-ink",
      alert: "px-3 font-bold text-ink",
      danger: "px-3 font-bold text-danger",
    },
  },
  defaultVariants: { tone: "muted" },
});

export type StatusTone = "muted" | "strong" | "alert" | "danger";

type StatusBadgeProps = {
  icon: IconName;
  label: string;
  tone?: StatusTone;
  className?: string;
};

/*
  상태 → 아이콘·글자 매핑은 화면마다 다르므로(실행: 준비 중/실행 중/완료/실패, 세션: 대기/진행 중/이탈…)
  각 화면에서 정하고 이 컴포넌트는 모양만 맡습니다.
    <StatusBadge icon="status-wait" label="준비 중" />
    <StatusBadge icon="status-error" label="실패" tone="alert" />
*/
export default function StatusBadge({ icon, label, tone = "muted", className }: StatusBadgeProps) {
  return (
    <span data-tone={tone} className={cn(badgeVariants({ tone }), className)}>
      <Icon
        name={icon}
        className={cn("size-5", (tone === "alert" || tone === "danger") && "text-danger")}
      />
      {label}
    </span>
  );
}
