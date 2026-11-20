import { type ReactNode, useId } from "react";

type AuthCardProps = { title: string; children: ReactNode };

export default function AuthCard({ title, children }: AuthCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="login-card flex shrink-0 flex-col gap-6 bg-surface px-6 py-10 sm:px-10"
    >
      <h1 id={titleId} className="text-center text-2xl leading-9 font-bold text-black">
        {title}
      </h1>
      {children}
    </section>
  );
}
