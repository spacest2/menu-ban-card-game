import { ReactNode } from "react";

export function MobileShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Real-time Mobile Card Game MVP</p>
        <h1>{title}</h1>
        {subtitle ? <p className="hero-copy">{subtitle}</p> : null}
      </section>
      <section className="page-stack">{children}</section>
    </main>
  );
}
