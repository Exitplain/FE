import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import type { OnboardingStep } from "@/constants/onboarding";

type Box = { left: number; top: number; width: number; height: number };
type Placement = {
  inline: boolean;
  box: Box | null;
  left: number;
  top: number;
  width: number;
  arrow: "left" | "right" | "top" | "bottom" | null;
  arrowOffset: number;
  host: HTMLElement;
};

function findTarget(marker: HTMLElement | null, step?: OnboardingStep, report?: boolean) {
  const scope = marker?.parentElement;
  if (report) return scope?.querySelector<HTMLElement>("#summary") ?? null;
  if (step === "intro") return document.querySelector<HTMLElement>('[data-tour="create-project"]');
  if (step === "create") return marker?.closest<HTMLElement>('[role="dialog"]') ?? null;
  if (step === "test") return scope?.querySelector<HTMLElement>('a[href$="/tests/new"]') ?? null;
  if (step === "ready")
    return scope?.querySelector<HTMLElement>('[aria-label="페르소나 세그먼트"]') ?? null;
  return scope?.querySelector<HTMLElement>(`[data-onboarding-region="${step}"]`) ?? null;
}

/** Visual scrim is transparent to pointer input: the real forms remain usable. */
export default function Coachmark({
  marker,
  step,
  report,
  collapsed,
  children,
}: {
  marker: RefObject<HTMLDivElement | null>;
  step?: OnboardingStep;
  report: boolean;
  collapsed: boolean;
  children: ReactNode;
}) {
  const maskId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Placement>({
    inline: false,
    box: null,
    left: 16,
    top: 16,
    width: 300,
    arrow: null,
    arrowOffset: 24,
    host: document.body,
  });

  useLayoutEffect(() => {
    let frame = 0;
    let previousTarget: HTMLElement | null = null;
    const resize = new ResizeObserver(() => schedule());
    const place = () => {
      const target = findTarget(marker.current, step, report);
      if (target !== previousTarget) {
        if (previousTarget) resize.unobserve(previousTarget);
        if (target) resize.observe(target);
        previousTarget = target;
      }
      const rect = target?.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.max(6, (rect?.left ?? 0) - 6);
      const top = Math.max(6, (rect?.top ?? 0) - 6);
      const right = Math.min(vw - 6, (rect?.right ?? 0) + 6);
      const bottom = Math.min(vh - 6, (rect?.bottom ?? 0) + 6);
      const box =
        rect && rect.width > 0 && rect.height > 0 && right > left && bottom > top
          ? { left, top, width: right - left, height: bottom - top }
          : null;
      // A form uses most of the work area; fit its hint in the sidebar when possible.
      const sideSpace = box ? Math.max(box.left, vw - box.left - box.width) - 32 : 300;
      // Wide forms in narrow windows get an in-flow hint instead of covering fields.
      const inline = Boolean(box && step !== "intro" && sideSpace < 240 && box.width > vw * 0.7);
      const width = Math.min(300, vw - 24, sideSpace >= 240 ? sideSpace : 300);
      const height = panel.current?.offsetHeight || 220;
      let x = Math.max(12, vw - width - 16);
      let y = Math.max(12, vh - height - 16);
      let arrow: Placement["arrow"] = null;
      if (box && !collapsed) {
        if (box.left + box.width + 16 + width <= vw - 12) {
          x = box.left + box.width + 16;
          y = box.top;
          arrow = "left";
        } else if (box.left - 16 - width >= 12) {
          x = box.left - 16 - width;
          y = box.top;
          arrow = "right";
        } else if (box.top >= height + 28) {
          x = box.left;
          y = box.top - height - 16;
          arrow = "bottom";
        } else if (box.top + box.height + height + 28 <= vh) {
          x = box.left;
          y = box.top + box.height + 16;
          arrow = "top";
        }
      }
      x = Math.max(12, Math.min(x, vw - width - 12));
      y = Math.max(12, Math.min(y, vh - height - 12));
      const offset = box
        ? arrow === "left" || arrow === "right"
          ? Math.max(20, Math.min(box.top + Math.min(box.height / 2, 40) - y, height - 20))
          : Math.max(20, Math.min(box.left + box.width / 2 - x, width - 20))
        : 24;
      // Stay inside an existing modal so its focus trap also includes these controls.
      const host =
        (inline ? marker.current : marker.current?.closest<HTMLElement>('[role="dialog"]')) ??
        document.body;
      setPosition((prev) =>
        prev.inline === inline &&
        prev.left === x &&
        prev.top === y &&
        prev.width === width &&
        prev.arrow === arrow &&
        prev.arrowOffset === offset &&
        prev.host === host &&
        JSON.stringify(prev.box) === JSON.stringify(box)
          ? prev
          : { inline, box, left: x, top: y, width, arrow, arrowOffset: offset, host },
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    if (panel.current) resize.observe(panel.current);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [marker, step, report, collapsed, position.host]);

  const { box, arrow, arrowOffset } = position;
  return createPortal(
    <>
      {box && !collapsed && (
        <>
          <svg
            data-testid="onboarding-scrim"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
          >
            <defs>
              <mask id={maskId}>
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={box.left}
                  y={box.top}
                  width={box.width}
                  height={box.height}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,.5)" mask={`url(#${maskId})`} />
          </svg>
          <div
            data-testid="onboarding-highlight"
            aria-hidden="true"
            className="pointer-events-none fixed z-[61] rounded-xl ring-2 ring-white"
            style={box}
          />
        </>
      )}
      <div
        ref={panel}
        data-testid="onboarding-coachmark"
        className={
          position.inline
            ? "relative z-[62] w-full text-ink"
            : "fixed z-[62] max-h-[calc(100dvh-24px)] text-ink"
        }
        style={
          position.inline
            ? undefined
            : { left: position.left, top: position.top, width: position.width }
        }
      >
        {arrow && box && !collapsed && !position.inline && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-3 rotate-45 bg-surface"
            style={
              arrow === "left"
                ? { left: -6, top: arrowOffset - 6 }
                : arrow === "right"
                  ? { right: -6, top: arrowOffset - 6 }
                  : arrow === "top"
                    ? { top: -6, left: arrowOffset - 6 }
                    : { bottom: -6, left: arrowOffset - 6 }
            }
          />
        )}
        <div
          className={
            position.inline
              ? "relative rounded-xl border border-line bg-surface p-4 shadow-sm"
              : "relative max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl bg-surface p-5 shadow-dialog"
          }
        >
          {children}
        </div>
      </div>
    </>,
    position.host,
  );
}
